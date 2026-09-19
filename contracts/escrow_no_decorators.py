from genlayer import *

class P2PEscrow(gl.Contract):
    def __init__(self):
        self.trades = {}
        self.offers = {}
        self.profiles = {}
        self.offer_counter = 0
        self.trade_counter = 0

    def register_profile(self, bank_name, account_number, account_name, contact_handle):
        self.profiles[str(self.sender())] = {
            'bank_name': bank_name,
            'account_number': account_number,
            'account_name': account_name,
            'contact_handle': contact_handle,
        }

    def get_profile(self, addr):
        return self.profiles.get(addr, {})

    def post_offer(self, token, crypto_amount, fiat_currency, fiat_amount, rate, payment_methods):
        offer_id = self.offer_counter
        self.offer_counter = self.offer_counter + 1
        self.offers[offer_id] = {
            'offer_id': offer_id,
            'seller': str(self.sender()),
            'token': token,
            'crypto_amount': crypto_amount,
            'fiat_currency': fiat_currency,
            'fiat_amount': fiat_amount,
            'rate': rate,
            'payment_methods': payment_methods,
            'status': 'open',
        }
        return offer_id

    def lock_order(self, offer_id):
        offer = self.offers[offer_id]
        if offer['status'] != 'open':
            raise Exception('Offer not open')
        addr = str(self.sender())
        buyer_profile = self.get_profile(addr)
        seller_profile = self.get_profile(offer['seller'])
        tid = self.trade_counter
        self.trade_counter = self.trade_counter + 1
        self.trades[tid] = {
            'trade_id': tid,
            'offer_id': offer_id,
            'seller': offer['seller'],
            'buyer': addr,
            'token': offer['token'],
            'crypto_amount': offer['crypto_amount'],
            'fiat_currency': offer['fiat_currency'],
            'fiat_amount': offer['fiat_amount'],
            'rate': offer['rate'],
            'buyer_contact': buyer_profile.get('contact_handle', ''),
            'seller_contact': seller_profile.get('contact_handle', ''),
            'status': 'locked',
        }
        return tid

    def get_trade(self, trade_id):
        return self.trades.get(trade_id, {})

    def get_contact_info(self, trade_id):
        trade = self.trades.get(trade_id, {})
        return {
            'buyer_contact': trade.get('buyer_contact', ''),
            'seller_contact': trade.get('seller_contact', ''),
        }
