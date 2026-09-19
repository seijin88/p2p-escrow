# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class P2PEscrow(gl.Contract):
    trades : TreeMap[u256, str]
    offers : TreeMap[u256, str]
    offer_counter : u256
    trade_counter : u256
    profiles : TreeMap[str, str]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def register_profile(self, bank_name: str, account_number: str, account_name: str, contact_handle: str) -> None:
        commitment = hashlib.sha256('|'.join([bank_name, account_number, account_name]).encode()).hexdigest()
        data = {
            'address': str(gl.message.sender_address),
            'commitment': commitment,
            'bank_name_hint': bank_name[:4],
            'contact_handle': contact_handle,
            'reported_at': self._now()
        }
        self.profiles[str(gl.message.sender_address)] = json.dumps(data)

    @gl.public.view
    def get_profile(self, addr: str):
        try:
            return json.loads(self.profiles[addr])
        except Exception:
            return None

    @gl.public.write.payable
    def post_offer(
        self,
        token: str,
        crypto_amount: str,
        fiat_currency: str,
        fiat_amount: str,
        rate: str,
        payment_methods: str,
        expires_at: u256 = None,
    ) -> u256:
        _require(token in ['GEN'], 'Unsupported token')
        _require(fiat_currency in ['IDR', 'USD'], 'Unsupported fiat')
        _require(expires_at is None or expires_at > self._now(), 'Invalid expiry')
        try:
            json.loads(self.profiles[str(gl.message.sender_address)])
        except Exception:
            raise Exception('Register profile first')
        offer_id = int(self.offer_counter)
        offer = {
            'offer_id': offer_id,
            'seller': str(gl.message.sender_address),
            'token': token,
            'crypto_amount': crypto_amount,
            'fiat_currency': fiat_currency,
            'fiat_amount': fiat_amount,
            'rate': rate,
            'payment_methods': payment_methods,
            'status': 'open',
            'created_at': self._now(),
            'expires_at': expires_at if expires_at is not None else self._now() + 86400,
        }
        self.offers[offer_id] = json.dumps(offer)
        self.offer_counter += 1
        return u256(offer_id)

    @gl.public.write
    def lock_order(self, offer_id: u256) -> u256:
        offer = json.loads(self.offers[offer_id])
        _require(offer['status'] == 'open', 'Offer not open')
        _require(offer['seller'] != str(gl.message.sender_address), 'Seller cannot buy')
        _require(self._now() <= offer['expires_at'], 'Offer expired')
        try:
            buyer_profile = json.loads(self.profiles[str(gl.message.sender_address)])
        except Exception:
            raise Exception('Register profile first')
        token = offer['token']
        fiat_currency = offer['fiat_currency']
        quoted_rate = int(offer['rate'])
        _require(token in ['GEN'], 'Unsupported token')
        _require(fiat_currency in ['IDR', 'USD'], 'Unsupported fiat')

        def leader_fn():
            price_usd = None
            try:
                resp = gl.nondet.web.get('https://api.kraken.com/0/public/Ticker?pair=GENUSD')
                body = json.loads(resp.body)
                result = body.get('result', {})
                ticker = next((v for k, v in result.items() if k.upper().startswith('GEN')), None)
                if ticker:
                    price_usd = float(ticker[0])
            except Exception:
                price_usd = None
            if price_usd is None or price_usd <= 0:
                try:
                    resp = gl.nondet.web.get('https://api.coingecko.com/api/v3/simple/price?ids=genlayer&vs_currencies=' + fiat_currency.lower())
                    price_usd = float(json.loads(resp.body)['genlayer']['usd'])
                except Exception:
                    price_usd = None
            fx_rate = 1.0
            if price_usd is not None and price_usd > 0 and fiat_currency != 'USD':
                try:
                    resp = gl.nondet.web.get('https://api.kraken.com/0/public/Ticker?pair=USD' + fiat_currency.upper())
                    body = json.loads(resp.body)
                    result = body.get('result', {})
                    ticker = next((v for k, v in result.items() if 'USD' in k.upper()), None)
                    if ticker:
                        fx_rate = float(ticker[0])
                except Exception:
                    fx_rate = 1.0
            market_price_in_fiat = price_usd * fx_rate if price_usd else 0.0
            market_micro = int(round(market_price_in_fiat * 1000000))
            if market_micro <= 0:
                return {'market_micro': quoted_rate * 1000000, 'deviation_pct': 0, 'within_limit': True}
            quoted_micro = quoted_rate * 1000000
            deviation = abs(quoted_micro - market_micro) * 100 // market_micro
            return {'market_micro': market_micro, 'deviation_pct': deviation, 'within_limit': deviation <= 5}

        def validator_fn(lr):
            if not isinstance(lr, gl.vm.Return):
                return False
            try:
                lv = leader_fn()
                vr = lr.calldata
                return vr.get('within_limit') == lv.get('within_limit') and vr.get('market_micro') == lv.get('market_micro') and vr.get('deviation_pct') == lv.get('deviation_pct')
            except Exception:
                return False

        r = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        _require(int(r.get('market_micro', 0)) > 0, 'Market rate unavailable')
        _require(bool(r.get('within_limit', False)), 'Rate rejected')

        now = self._now()
        self.trade_counter = self.trade_counter + u256(1)
        tid = int(self.trade_counter)
        buyer = str(gl.message.sender_address)
        buyer_contact = buyer_profile.get('contact_handle', '')
        seller_profile = json.loads(self.profiles[offer['seller']])
        seller_contact = seller_profile.get('contact_handle', '')
        trade = {
            'trade_id': tid,
            'offer_id': int(offer_id),
            'seller': offer['seller'],
            'buyer': buyer,
            'token': token,
            'crypto_amount': offer['crypto_amount'],
            'fiat_currency': fiat_currency,
            'fiat_amount': offer['fiat_amount'],
            'rate': offer['rate'],
            'market_price_micro_at_lock': str(r.get('market_micro', 0)),
            'buyer_contact': buyer_contact,
            'seller_contact': seller_contact,
            'rate_deviation_pct': int(r.get('deviation_pct', 0)),
            'payment_methods': offer['payment_methods'],
            'status': 'locked',
            'created_at': now,
            'paid_at': None,
            'settled_at': None,
            'verdict': None,
            'reason': None,
            'arbitration_open': False,
            'payment_tx_id': None,
        }
        self.trades[tid] = json.dumps(trade)
        return u256(tid)

    @gl.public.write
    def mark_paid(self, tx_id: str) -> None:
        trade = self._get_active_trade_for_buyer(gl.message.sender_address)
        _require(trade is not None, 'No active trade')
        _require(trade['status'] == 'locked', 'Trade not locked')
        _require(trade['buyer'] == str(gl.message.sender_address), 'Not the buyer')
        _require(self._now() <= trade['created_at'] + 3600, 'Payment window expired')
        trade['payment_tx_id'] = tx_id
        trade['status'] = 'paid'
        trade['paid_at'] = self._now()
        self._save_trade(trade['trade_id'], trade)

    def _get_active_trade_for_buyer(self, addr):
        try:
            last_tid = self._last_trade_id(str(addr))
            trades_data = json.loads(self.trades.get(last_tid, '{}'))
            if trades_data.get('buyer') == str(addr) and trades_data.get('status') in ['locked', 'paid']:
                return trades_data
        except Exception:
            pass
        return None

    def _last_trade_id(self, addr: str):
        return addr

    def _save_trade(self, trade_id: u256, trade: dict) -> None:
        self.trades[trade_id] = json.dumps(trade)

    @gl.public.write
    def release_crypto(self) -> None:
        trade = self._get_active_trade_for_seller(gl.message.sender_address)
        _require(trade is not None, 'No active trade')
        _require(trade['status'] == 'paid', 'Not paid')
        _require(trade['seller'] == str(gl.message.sender_address), 'Not the seller')
        _require(self._now() >= trade['paid_at'] + 1800, 'Release window not open')
        trade['status'] = 'settled'
        trade['settled_at'] = self._now()
        self._save_trade(trade['trade_id'], trade)

    def _get_active_trade_for_seller(self, addr):
        try:
            last_tid = self._last_trade_id(str(addr))
            trades_data = json.loads(self.trades.get(last_tid, '{}'))
            if trades_data.get('seller') == str(addr) and trades_data.get('status') in ['paid']:
                return trades_data
        except Exception:
            pass
        return None

    @gl.public.view
    def get_trade(self, trade_id: u256):
        try:
            t = json.loads(self.trades[trade_id])
            return {
                'trade_id': t.get('trade_id'),
                'status': t.get('status'),
                'seller': t.get('seller'),
                'buyer': t.get('buyer'),
                'token': t.get('token'),
                'crypto_amount': t.get('crypto_amount'),
                'fiat_currency': t.get('fiat_currency'),
                'fiat_amount': t.get('fiat_amount'),
                'rate': t.get('rate'),
                'buyer_contact': t.get('buyer_contact', ''),
                'seller_contact': t.get('seller_contact', ''),
            }
        except Exception:
            return None

    @gl.public.view
    def get_contact_info(self, trade_id: u256):
        try:
            t = json.loads(self.trades[trade_id])
            return {
                'buyer': t.get('buyer_contact', ''),
                'seller': t.get('seller_contact', ''),
            }
        except Exception:
            return {'buyer': '', 'seller': ''}

    def _now(self) -> u256:
        return gl.block.timestamp

def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise Exception(msg)
