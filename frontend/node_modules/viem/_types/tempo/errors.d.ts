import type { Address } from 'abitype';
import type { Hex } from 'ox';
import { BaseError } from '../errors/base.js';
export type GetVaultEngineChangedErrorType = GetVaultEngineChangedError & {
    name: 'GetVaultEngineChangedError';
};
export declare class GetVaultEngineChangedError extends BaseError {
    constructor({ vault }: {
        vault: Address;
    });
}
export type WaitForPrivateDepositTimeoutErrorType = WaitForPrivateDepositTimeoutError & {
    name: 'WaitForPrivateDepositTimeoutError';
};
/** Thrown when a Zone gateway deposit event is not found before the timeout. */
export declare class WaitForPrivateDepositTimeoutError extends BaseError {
    constructor({ actionId, gateway }: {
        actionId: Hex.Hex;
        gateway: Address;
    });
}
export type WaitForTempoBlockTimeoutErrorType = WaitForTempoBlockTimeoutError & {
    name: 'WaitForTempoBlockTimeoutError';
};
export declare class WaitForTempoBlockTimeoutError extends BaseError {
    constructor({ tempoBlockNumber }: {
        tempoBlockNumber: bigint;
    });
}
export type WaitForPrivateRedeemTimeoutErrorType = WaitForPrivateRedeemTimeoutError & {
    name: 'WaitForPrivateRedeemTimeoutError';
};
/** Thrown when a Zone gateway redeem event is not found before the timeout. */
export declare class WaitForPrivateRedeemTimeoutError extends BaseError {
    constructor({ actionId, gateway }: {
        actionId: Hex.Hex;
        gateway: Address;
    });
}
export type InvalidFeeTokenErrorType = InvalidFeeTokenError & {
    name: 'InvalidFeeTokenError';
};
export declare class InvalidFeeTokenError extends BaseError {
    constructor({ cause, token, }: {
        cause?: BaseError | Error | undefined;
        token: string;
    });
}
export type FeeTokenNotTip20ErrorType = FeeTokenNotTip20Error & {
    name: 'FeeTokenNotTip20Error';
};
export declare class FeeTokenNotTip20Error extends BaseError {
    constructor({ token }: {
        token: string;
    });
}
export type FeeTokenNotUsdErrorType = FeeTokenNotUsdError & {
    name: 'FeeTokenNotUsdError';
};
export declare class FeeTokenNotUsdError extends BaseError {
    constructor({ currency, token, }: {
        currency: string;
        token: string;
    });
}
export type FeeTokenPausedErrorType = FeeTokenPausedError & {
    name: 'FeeTokenPausedError';
};
export declare class FeeTokenPausedError extends BaseError {
    constructor({ token }: {
        token: string;
    });
}
//# sourceMappingURL=errors.d.ts.map