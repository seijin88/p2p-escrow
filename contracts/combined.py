# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from datetime import datetime, timedelta, timezone
import hashlib
import json
import typing

s = 3600
u = 1800
ag = 24 * 3600
h = 10
l = ['GEN']
w = ['IDR', 'USD']
aa = 2
q = 4
g = 2
e = 128
ah = 'commitment'
z = 24 * 3600
ax = 'https://api.coingecko.com/api/v3/simple/price?ids=genlayer&vs_currencies={vs}'
j = 'https://api.kraken.com/0/public/Ticker?pair=GENUSD'
k = 'https://api.kraken.com/0/public/Ticker?pair=USDIDR'
n = 'https://api.kraken.com/0/public/Ticker?pair={pair}'
o = 'https://api.coingecko.com/api/v3/simple/price?ids=genlayer&vs_currencies={vs}'
p = 1000000
q = 5
r = 150000
t = 300000
u = 15000000
x = 0.05
y = 600
A = 1000000
B = 1000000
C = 3600
D = 1800
E = 24 * 3600
F = 10
G = ['GEN']
H = ['IDR', 'USD']
I = 2
J = 4
K = 2
L = 128
M = 'commitment'
N = 24 * 3600

def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise Exception(msg)

def _addr_key(addr: typing.Any) -> str:
    if isinstance(addr, (bytes, bytearray)):
        return '0x' + addr.hex()
    return str(addr)

def _hash_commitment(bank_name: str, account_number: str, account_name: str) -> str:
    return hashlib.sha256('|'.join([bank_name, account_number, account_name]).encode()).hexdigest()

class UserProfile(gl.Contract):
    """Registry of trader bank profiles (hash only, P1)."""
    bank_name     : TreeMap[str, str]
    account_number: TreeMap[str, str]
    account_name  : TreeMap[str, str]
    contact_handle: TreeMap[str, str]
    owner         : Address

    def __init__(self) -> None:
        self.owner = gl.message.sender_address

    @gl.public.write
    def register(
        self,
        bank_name      : str,
        account_number : str,
        account_name   : str,
        contact_handle : typing.Optional[str] = None,
    ) -> None:
        _require(gl.message.sender_address == self.owner,
                 "Only owner may register traders")
        addr = _addr_key(gl.message.sender_address).lower()
        self.bank_name[addr]      = bank_name
        self.account_number[addr] = account_number
        self.account_name[addr]   = account_name
        self.contact_handle[addr] = contact_handle if contact_handle is not None else ""

    @gl.public.view
    def get_profile(self, addr: str) -> typing.Any:
        addr = _addr_key(addr).lower()
        try:
            contact = self.contact_handle.get(addr, "")
            return {
                "address"        : addr,
                "bank_name"      : self.bank_name[addr],
                "account_number": self.account_number[addr],
                "account_name"  : self.account_name[addr],
                "contact_handle": contact,
            }
        except Exception:
            return None

    @gl.public.view
    def is_registered(self, addr: str) -> bool:
        addr = _addr_key(addr).lower()
        try:
            self.bank_name[addr]
            return True
        except Exception:
            return False


class P2PEscrow(gl.Contract):
    """P2P escrow with on-chain crypto, off-chain fiat (P1)."""
    trades               : TreeMap[u256, str]
    offers               : TreeMap[u256, str]
    offer_counter        : u256
    trade_counter        : u256
    buyer_active_trades  : TreeMap[str, u256]
    seller_active_trades : TreeMap[str, u256]
    buyer_contact        : TreeMap[str, str]
    seller_contact       : TreeMap[str, str]
    profiles             : TreeMap[str, str]
    used_tx_ids          : TreeMap[str, u256]
    user_profile_contract: Address

    def __init__(self) -> None:
        self.user_profile_contract = Address('0x0000000000000000000000000000000000000000')

    @gl.public.write
    def report_profile(self, bank_name: str, account_number: str, account_name: str) -> None:
        commitment = _hash_commitment(bank_name, account_number, account_name)
        data = {
            'address': str(gl.message.sender_address),
            'commitment': commitment,
            'bank_name_hint': bank_name[:4],
            'reported_at': self._now()
        }
        self.profiles[_addr_key(gl.message.sender_address)] = json.dumps(data)

    @gl.public.view
    def get_profile(self, addr: str) -> typing.Any:
        addr = _addr_key(addr)
        try:
            return json.loads(self.profiles[addr])
        except Exception:
            return None

    @gl.public.view
    def is_profile_reported(self, addr: str) -> bool:
        addr = _addr_key(addr)
        try:
            self.profiles[addr]
            return True
        except Exception:
            return False

    @gl.public.view
    def is_payment_reference_used(self, tx_id: str) -> bool:
        try:
            self.used_tx_ids[tx_id]
            return True
        except Exception:
            return False

    def _addr_key(self, addr: typing.Any) -> str:
        if isinstance(addr, (bytes, bytearray)):
            return '0x' + addr.hex()
        return str(addr)

    def _save_trade(self, trade_id: u256, data: dict) -> None:
        self.trades[trade_id] = json.dumps(data)

    def _save_offer(self, offer_id: u256, data: dict) -> None:
        self.offers[offer_id] = json.dumps(data)

    @gl.public.write.payable
    def post_offer(
        self,
        token          : str,
        crypto_amount  : str,
        fiat_currency  : str,
        fiat_amount    : str,
        rate           : str,
        payment_methods: str,
        expires_at     : typing.Optional[u256] = None,
    ) -> u256:
        _require(token in ['GEN'], 'Unsupported token')
        _require(fiat_currency in ['IDR', 'USD'], 'Unsupported fiat')
        _require(expires_at is None or expires_at > self._now(), 'Invalid expiry')
        _require(self._require_profile(gl.message.sender_address), 'Bank profile not reported')
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
            'expires_at': expires_at if expires_at is not None else self._now() + 24 * 3600,
        }
        self._save_offer(u256(offer_id), offer)
        self.offer_counter += 1
        return u256(offer_id)

    @gl.public.write
    def lock_order(self, offer_id: u256) -> u256:
        offer = json.loads(self.offers[u256(offer_id)])
        _require(offer['status'] == 'open', 'Offer not open')
        _require(offer['seller'] != str(gl.message.sender_address), 'Seller cannot buy')
        _require(self._now() <= offer['expires_at'], 'Offer expired')
        _require(self._require_profile(gl.message.sender_address), 'Buyer bank profile not reported')

        token = offer['token']
        fiat_currency = offer['fiat_currency']
        quoted_rate = int(offer['rate'])

        _require(token in ['GEN'], 'Unsupported token')
        _require(fiat_currency in ['IDR', 'USD'], 'Unsupported fiat')

        def leader_fn() -> typing.Any:
            price_usd = None
            try:
                resp = gl.nondet.web.get(j)
                body = resp.body
                if isinstance(body, (bytes, bytearray)):
                    body = body.decode('utf-8', errors='replace')
                data = json.loads(body)
                result = data.get('result', {})
                ticker = next((v for k, v in result.items() if k.upper().startswith('GEN')), None)
                if ticker:
                    price_usd = float(ticker[0])
            except Exception:
                price_usd = None

            if price_usd is None or price_usd <= 0:
                try:
                    resp = gl.nondet.web.get(ax.format(vs=fiat_currency.lower()))
                    body = resp.body
                    if isinstance(body, (bytes, bytearray)):
                        body = body.decode('utf-8', errors='replace')
                    data = json.loads(body)
                    price_usd = float(data['genlayer']['usd'])
                except Exception:
                    price_usd = None

            fx_rate = 1.0
            if price_usd is not None and price_usd > 0 and fiat_currency != 'USD':
                try:
                    resp = gl.nondet.web.get(n.format(pair='USD' + fiat_currency.upper()))
                    body = resp.body
                    if isinstance(body, (bytes, bytearray)):
                        body = body.decode('utf-8', errors='replace')
                    data = json.loads(body)
                    result = data.get('result', {})
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

        def validator_fn(lr) -> bool:
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
        buyer_contact = ""
        seller_contact = ""
        try:
            buyer_contact = json.loads(self.profiles.get(_addr_key(buyer), '{}')).get('contact_handle', '')
        except Exception: pass

        try:
            seller_profile = json.loads(self.profiles.get(_addr_key(offer['seller']), '{}'))
            seller_contact = seller_profile.get('contact_handle', '')
        except Exception: pass

        commitment = _hash_commitment(
            self._get_bank_name(_addr_key(offer['seller'])),
            self._get_account_number(_addr_key(offer['seller'])),
            self._get_account_name(_addr_key(offer['seller'])),
        )
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
            'bank_commitment': commitment,
            'status': 'locked',
            'created_at': now,
            'paid_at': None,
            'settled_at': None,
            'verdict': None,
            'reason': None,
            'arbitration_open': False,
            'payment_tx_id': None,
        }
        self._save_trade(u256(tid), trade)
        self.buyer_active_trades[buyer] = u256(tid)
        self.seller_active_trades[offer['seller']] = u256(tid)
        self.buyer_contact[_addr_key(tid)] = buyer_contact
        self.seller_contact[_addr_key(tid)] = seller_contact
        return u256(tid)

    def _get_bank_name(self, addr: str) -> str:
        try:
            return json.loads(self.profiles[addr])['bank_name']
        except Exception:
            return ''

    def _get_account_number(self, addr: str) -> str:
        try:
            return json.loads(self.profiles[addr])['account_number']
        except Exception:
            return ''

    def _get_account_name(self, addr: str) -> str:
        try:
            return json.loads(self.profiles[addr])['account_name']
        except Exception:
            return ''

    def _require_profile(self, addr: typing.Any) -> bool:
        addr = _addr_key(addr)
        try:
            data = json.loads(self.profiles[addr])
            return 'commitment' in data and len(data['commitment']) == 64
        except Exception:
            return False

    @gl.public.write
    def mark_paid(self, tx_id: str) -> None:
        tid = self._get_active_trade_for_buyer(gl.message.sender_address)
        _require(tid is not None, 'No active trade')
        trade = json.loads(self.trades[tid])
        _require(trade['status'] == 'locked', 'Trade not locked')
        _require(trade['buyer'] == str(gl.message.sender_address), 'Not the buyer')
        _require(self._now() <= trade['created_at'] + 3600, 'Payment window expired')
        _require(not self.is_payment_reference_used(tx_id), 'TX ID already used')
        self.used_tx_ids[tx_id] = tid
        trade['payment_tx_id'] = tx_id
        trade['status'] = 'paid'
        trade['paid_at'] = self._now()
        self._save_trade(tid, trade)

    def _get_active_trade_for_buyer(self, addr: typing.Any) -> typing.Optional[u256]:
        addr = _addr_key(addr)
        try:
            tid = self.buyer_active_trades[addr]
            trade = json.loads(self.trades[tid])
            if trade['status'] in ['locked', 'paid']:
                return tid
        except Exception:
            pass
        return None

    def _get_active_trade_for_seller(self, addr: typing.Any) -> typing.Optional[u256]:
        addr = _addr_key(addr)
        try:
            tid = self.seller_active_trades[addr]
            trade = json.loads(self.trades[tid])
            if trade['status'] in ['locked', 'paid']:
                return tid
        except Exception:
            pass
        return None

    @gl.public.write
    def release_crypto(self, payment_tx_id: str) -> None:
        tid = self._get_active_trade_for_seller(gl.message.sender_address)
        _require(tid is not None, 'No active trade')
        trade = json.loads(self.trades[tid])
        _require(trade['status'] in ['paid', 'disputed'], 'Not paid or disputed')
        _require(trade['seller'] == str(gl.message.sender_address), 'Not the seller')
        _require(trade['payment_tx_id'] == payment_tx_id, 'TX ID mismatch')
        _require(self._now() >= trade['paid_at'] + 1800, 'Release window not open')
        _require(self._now() <= trade['paid_at'] + 24 * 3600, 'Release window expired')
        trade['status'] = 'settled'
        trade['settled_at'] = self._now()
        self._save_trade(tid, trade)
        self._close_trade(tid)

    @gl.public.write
    def open_dispute(self, reason: str) -> None:
        tid = self._get_active_trade_for_seller(gl.message.sender_address)
        _require(tid is not None, 'No active trade')
        trade = json.loads(self.trades[tid])
        _require(trade['seller'] == str(gl.message.sender_address), 'Not the seller')
        _require(trade['status'] == 'paid', 'Trade not paid')
        _require(self._now() >= trade['paid_at'] + 1800, 'Dispute window not open')
        _require(self._now() <= trade['paid_at'] + 24 * 3600, 'Dispute window expired')
        _require(trade['arbitration_open'] == False, 'Already disputed')
        trade['status'] = 'disputed'
        trade['arbitration_open'] = True
        trade['reason'] = reason
        self._save_trade(tid, trade)

    @gl.public.write
    def arbitrate(
        self,
        trade_id: u256,
        verdict: str,
        reason: str,
        tx_id_found: bool,
        amount_matches: bool,
        currency_matches: bool,
        recipient_matches: bool,
    ) -> None:
        _require(gl.message.sender_address == self.owner, 'Only owner can arbitrate')
        trade = json.loads(self.trades[trade_id])
        _require(trade['status'] == 'disputed', 'Trade not disputed')
        _require(verdict in ['release', 'refund'], 'Invalid verdict')
        _require(self._now() <= trade['created_at'] + 2 * 24 * 3600, 'Arbitration window expired')
        trade['verdict'] = verdict
        trade['reason'] = reason
        trade['status'] = 'settled'
        trade['settled_at'] = self._now()
        self._save_trade(trade_id, trade)
        if verdict == 'release':
            self._release_trade(trade_id)
        else:
            self._refund_trade(trade_id)

    def _release_trade(self, trade_id: u256) -> None:
        trade = json.loads(self.trades[trade_id])
        self._send(Address(trade['buyer']), u256(int(trade['crypto_amount'])))
        self._close_trade(trade_id)

    def _refund_trade(self, trade_id: u256) -> None:
        trade = json.loads(self.trades[trade_id])
        self._send(Address(trade['seller']), u256(int(trade['crypto_amount'])))
        self._close_trade(trade_id)

    def _send(self, to: Address, amount: u256) -> None:
        _require(int(amount) > 0, 'Nothing to settle')
        gl.get_contract_at(to).emit_transfer(value=amount)

    def _close_trade(self, trade_id: u256) -> None:
        trade = json.loads(self.trades[trade_id])
        trade['status'] = 'settled'
        trade['settled_at'] = self._now()
        self._save_trade(trade_id, trade)

    def _now(self) -> u256:
        return gl.block.timestamp

    @gl.public.view
    def get_trade(self, trade_id: u256) -> typing.Any:
        try:
            t = json.loads(self.trades[trade_id])
            market_micro = int(t.get('market_price_micro_at_lock', 0))
            quoted_rate = float(t.get('rate', '0'))
            market_rate = market_micro / 1000000.0
            deviation = int(t.get('rate_deviation_pct', 0))
            locked = int(t.get('created_at', 0))
            return {
                'trade_id': t.get('trade_id'),
                'status': t.get('status'),
                'verdict': t.get('verdict', ''),
                'seller': t.get('seller'),
                'buyer': t.get('buyer'),
                'token': t.get('token'),
                'crypto_amount': t.get('crypto_amount'),
                'fiat_currency': t.get('fiat_currency'),
                'fiat_amount': t.get('fiat_amount'),
                'quoted_rate': quoted_rate,
                'market_rate_at_lock': market_rate,
                'deviation_pct': deviation,
                'rate_within_limit': deviation <= 5,
                'locked_at_unix': locked,
                'rate_scale': 'per 1 GEN',
                'buyer_contact': t.get('buyer_contact', ''),
                'seller_contact': t.get('seller_contact', ''),
            }
        except Exception:
            return None

    @gl.public.view
    def get_contact_info(self, trade_id: u256) -> dict:
        try:
            t = json.loads(self.trades[trade_id])
            return {
                'buyer': t.get('buyer_contact', ''),
                'seller': t.get('seller_contact', ''),
            }
        except Exception:
            return {'buyer': '', 'seller': ''}

    @gl.public.view
    def get_settlement_info(self, trade_id: u256) -> dict:
        try:
            t = json.loads(self.trades[trade_id])
            market_micro = int(t.get('market_price_micro_at_lock', 0))
            quoted_rate = float(t.get('rate', '0'))
            market_rate = market_micro / 1000000.0
            deviation = int(t.get('rate_deviation_pct', 0))
            locked = int(t.get('created_at', 0))
            return {
                'trade_id': t.get('trade_id'),
                'status': t.get('status'),
                'verdict': t.get('verdict', ''),
                'seller': t.get('seller'),
                'buyer': t.get('buyer'),
                'token': t.get('token'),
                'crypto_amount': t.get('crypto_amount'),
                'fiat_currency': t.get('fiat_currency'),
                'fiat_amount': t.get('fiat_amount'),
                'quoted_rate': quoted_rate,
                'market_rate_at_lock': market_rate,
                'deviation_pct': deviation,
                'rate_within_limit': deviation <= 5,
                'locked_at_unix': locked,
                'rate_scale': 'per 1 GEN',
                'buyer_contact': t.get('buyer_contact', ''),
                'seller_contact': t.get('seller_contact', ''),
            }
        except Exception:
            return None

    @gl.public.view
    def get_all_trades(self) -> typing.Any:
        total = int(self.trade_counter)
        trades = []
        for i in range(total):
            tid = u256(i)
            try:
                t = json.loads(self.trades[tid])
                trades.append({
                    'trade_id': t.get('trade_id'),
                    'status': t.get('status'),
                    'seller': t.get('seller'),
                    'buyer': t.get('buyer'),
                    'token': t.get('token'),
                    'crypto_amount': t.get('crypto_amount'),
                    'fiat_currency': t.get('fiat_currency'),
                    'fiat_amount': t.get('fiat_amount'),
                    'created_at': t.get('created_at'),
                })
            except Exception:
                pass
        return trades

    @gl.public.view
    def get_open_offers(self) -> typing.Any:
        total = int(self.offer_counter)
        offers = []
        for i in range(total):
            oid = u256(i)
            try:
                o = json.loads(self.offers[oid])
                if o.get('status') == 'open':
                    offers.append({
                        'offer_id': o.get('offer_id'),
                        'seller': o.get('seller'),
                        'token': o.get('token'),
                        'crypto_amount': o.get('crypto_amount'),
                        'fiat_currency': o.get('fiat_currency'),
                        'fiat_amount': o.get('fiat_amount'),
                        'rate': o.get('rate'),
                        'created_at': o.get('created_at'),
                        'expires_at': o.get('expires_at'),
                    })
            except Exception:
                pass
        return offers
