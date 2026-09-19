# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
import hashlib

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
        commitment = hashlib.sha256((bank_name + account_number + account_name).encode()).hexdigest()
        data = {
            'address': str(gl.message.sender_address),
            'commitment': commitment,
            'bank_name': bank_name,
            'account_number': account_number,
            'account_name': account_name,
            'contact_handle': contact_handle,
        }
        self.profiles[str(gl.message.sender_address)] = json.dumps(data)

    @gl.public.view
    def get_profile(self, addr: str) -> dict:
        try:
            return json.loads(self.profiles[addr])
        except:
            return {}

    @gl.public.write.payable
    def post_offer(
        self,
        token: str,
        crypto_amount: str,
        fiat_currency: str,
        fiat_amount: str,
        rate: str,
        payment_methods: str,
    ) -> u256:
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
        }
        self.offers[offer_id] = json.dumps(offer)
        self.offer_counter += 1
        return u256(offer_id)

    @gl.public.write
    def lock_order(self, offer_id: u256) -> u256:
        offer = json.loads(self.offers[offer_id])
        if offer['status'] != 'open':
            raise Exception('Offer not open')
        if offer['seller'] == str(gl.message.sender_address):
            raise Exception('Seller cannot buy')
        buyer = str(gl.message.sender_address)
        buyer_profile = json.loads(self.profiles[buyer])
        if not buyer_profile:
            raise Exception('Register profile first')
        seller_profile = json.loads(self.profiles[offer['seller']])
        tid = int(self.trade_counter)
        self.trade_counter += 1
        trade = {
            'trade_id': tid,
            'offer_id': int(offer_id),
            'seller': offer['seller'],
            'buyer': buyer,
            'token': offer['token'],
            'crypto_amount': offer['crypto_amount'],
            'fiat_currency': offer['fiat_currency'],
            'fiat_amount': offer['fiat_amount'],
            'rate': offer['rate'],
            'buyer_contact': buyer_profile.get('contact_handle', ''),
            'seller_contact': seller_profile.get('contact_handle', ''),
            'status': 'locked',
        }
        self.trades[tid] = json.dumps(trade)
        return u256(tid)

    @gl.public.view
    def get_trade(self, trade_id: u256) -> dict:
        try:
            return json.loads(self.trades[trade_id])
        except:
            return {}

    @gl.public.view
    def get_contact_info(self, trade_id: u256) -> dict:
        try:
            t = json.loads(self.trades[trade_id])
            return {
                'buyer_contact': t.get('buyer_contact', ''),
                'seller_contact': t.get('seller_contact', ''),
            }
        except:
            return {'buyer_contact': '', 'seller_contact': ''}
