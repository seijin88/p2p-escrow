import * as Address from '../core/Address.js';
import * as Errors from '../core/Errors.js';
import * as Hex from '../core/Hex.js';
import * as KeyAuthorization_ from './KeyAuthorization.js';
import * as MultisigConfig from './MultisigConfig.js';
import * as SignatureEnvelope from './SignatureEnvelope.js';
import * as TxEnvelopeTempo from './TxEnvelopeTempo.js';
/** Fields shared by every multisig operation. */
export type Base<quantity = bigint> = {
    /** Root multisig account. */
    account: Address.Address;
    /** Every retained serialized owner approval. */
    approvals: readonly Hex.Hex[];
    /** Root configuration used to verify approvals. */
    config: MultisigConfig.Config<quantity>;
    /** Unix creation time in milliseconds. */
    createdAt: number;
    /** Deterministic multisig operation hash. */
    hash: Hex.Hex;
    /** Number of approvals selected for quorum evaluation. */
    signatureCount: number;
    /** Required root owner weight. */
    threshold: number;
    /** Unix time of the last update in milliseconds. */
    updatedAt: number;
    /** Root owner weight reached by the selected approvals. */
    weight: number;
};
/** Multisig transaction approval operation. */
export type TransactionOperation<quantity = bigint> = Base<quantity> & {
    /** Time when another relay may reclaim the submission lease. */
    expiresAt?: number | undefined;
    /** Current operation state. */
    status: 'pending' | 'submitting' | 'success';
    /** Fencing token owned by the current submitter. */
    submissionId?: Hex.Hex | undefined;
    /** Canonical serialized Tempo envelope without its outer sender signature. */
    transaction: Hex.Hex;
    /** Hash returned after the downstream submitter accepts the transaction. */
    transactionHash?: Hex.Hex | undefined;
    /** Operation kind. */
    type: 'transaction';
};
/** Multisig key authorization approval operation. */
export type KeyAuthorizationOperation<quantity = bigint> = Base<quantity> & {
    /** Canonical serialized key authorization. */
    keyAuthorization: Hex.Hex;
    /** Current operation state. */
    status: 'pending' | 'success';
    /** Operation kind. */
    type: 'keyAuthorization';
};
/** Transaction or key authorization multisig operation. */
export type Operation<quantity = bigint> = TransactionOperation<quantity> | KeyAuthorizationOperation<quantity>;
/** JSON-RPC multisig transaction operation. */
export type TransactionRpc = TransactionOperation<Hex.Hex>;
/** JSON-RPC multisig key authorization operation. */
export type KeyAuthorizationRpc = KeyAuthorizationOperation<Hex.Hex>;
/** JSON-RPC multisig operation. */
export type Rpc = Operation<Hex.Hex>;
/**
 * Derives the deterministic hash for a multisig operation.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { MultisigOperation } from 'ox/tempo'
 *
 * const hash = MultisigOperation.getHash({
 *   account,
 *   config,
 *   transaction,
 *   type: 'transaction',
 * })
 * ```
 *
 * @param options - Operation payload and multisig identity.
 * @returns The operation hash signed by each owner.
 */
export declare function getHash(options: getHash.Options): Hex.Hex;
export declare namespace getHash {
    /** Parameters for `getHash`. */
    type Options = {
        /** Root multisig account. */
        account: Address.Address;
        /** Complete root multisig configuration witness. */
        config: MultisigConfig.Config;
    } & ({
        /** Canonical serialized key authorization. */
        keyAuthorization: Hex.Hex;
        /** Operation kind. */
        type: 'keyAuthorization';
    } | {
        /** Canonical serialized Tempo envelope without its outer sender signature. */
        transaction: Hex.Hex;
        /** Operation kind. */
        type: 'transaction';
    });
    /** Error type for `getHash`. */
    type ErrorType = KeyAuthorization_.deserialize.ErrorType | KeyAuthorization_.getSignPayload.ErrorType | MultisigConfig.getSignPayload.ErrorType | TxEnvelopeTempo.deserialize.ErrorType | TxEnvelopeTempo.getSignPayload.ErrorType | Errors.GlobalErrorType;
}
/**
 * Validates, deduplicates, and selects owner approvals for an operation.
 *
 * The function retains one canonical approval per owner. It selects the
 * smallest deterministic quorum by owner weight, then orders the selected
 * approvals by owner address for serialization. The caller supplies the
 * account and config; the chain validates their factory-derived identity.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { MultisigOperation } from 'ox/tempo'
 *
 * const selection = await MultisigOperation.selectApprovals({
 *   account,
 *   approvals,
 *   config,
 *   hash,
 * })
 * ```
 *
 * @param options - Approval selection parameters.
 * @returns The retained approvals and deterministic quorum selection.
 */
export declare function selectApprovals(options: selectApprovals.Options): Promise<selectApprovals.ReturnValue>;
export declare namespace selectApprovals {
    /** Parameters for `selectApprovals`. */
    type Options = {
        /** Root multisig account. */
        account: Address.Address;
        /** Serialized primitive owner approvals. */
        approvals: readonly SignatureEnvelope.Serialized[];
        /** Current root multisig configuration. */
        config: MultisigConfig.Config;
        /** Deterministic operation hash approved by root owners. */
        hash: Hex.Hex;
    };
    /** Result of validating and selecting approvals. */
    type ReturnValue = {
        /** Every retained approval, ordered by owner address. */
        approvals: readonly SignatureEnvelope.Serialized[];
        /** Number of approvals selected for quorum evaluation. */
        signatureCount: number;
        /** Approvals selected for serialization, ordered by owner address. */
        selectedApprovals: readonly SignatureEnvelope.Serialized[];
        /** Required owner weight. */
        threshold: number;
        /** Owner weight reached by the selected approvals. */
        weight: number;
    };
    /** Error type for `selectApprovals`. */
    type ErrorType = InvalidApprovalError | MultisigConfig.assert.ErrorType | MultisigConfig.getSignPayload.ErrorType | SignatureEnvelope.CoercionError | SignatureEnvelope.extractAddress.ErrorType | SignatureEnvelope.serialize.ErrorType | SignatureEnvelope.VerificationError | Errors.GlobalErrorType;
}
/**
 * Serializes a key authorization with selected multisig owner approvals.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { MultisigOperation } from 'ox/tempo'
 *
 * const authorization = MultisigOperation.serializeKeyAuthorization(
 *   keyAuthorization,
 *   {
 *     account,
 *     approvals: selection.selectedApprovals,
 *     config,
 *   },
 * )
 * ```
 *
 * @param keyAuthorization - Canonical serialized unsigned key authorization.
 * @param options - Multisig account, config, and selected approvals.
 * @returns The signed serialized key authorization.
 */
export declare function serializeKeyAuthorization(keyAuthorization: Hex.Hex, options: serializeKeyAuthorization.Options): Hex.Hex;
export declare namespace serializeKeyAuthorization {
    /** Options for `serializeKeyAuthorization`. */
    type Options = {
        /** Root multisig account. */
        account: Address.Address;
        /** Selected serialized owner approvals. */
        approvals: readonly SignatureEnvelope.Serialized[];
        /** Complete applicable root multisig config. */
        config: MultisigConfig.Config;
    };
    /** Error type for `serializeKeyAuthorization`. */
    type ErrorType = InvalidOperationError | KeyAuthorization_.deserialize.ErrorType | KeyAuthorization_.from.ErrorType | KeyAuthorization_.getSignPayload.ErrorType | KeyAuthorization_.serialize.ErrorType | MultisigConfig.assert.ErrorType | SignatureEnvelope.assert.ErrorType | SignatureEnvelope.InvalidSerializedError | SignatureEnvelope.sortMultisigApprovals.ErrorType | Errors.GlobalErrorType;
}
/**
 * Serializes a multisig transaction operation with selected owner approvals.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { MultisigOperation } from 'ox/tempo'
 *
 * const transaction = MultisigOperation.serializeTransaction(operation, {
 *   approvals: selection.selectedApprovals,
 * })
 * ```
 *
 * @param operation - Multisig transaction operation.
 * @param options - Transaction serialization options.
 * @returns The signed serialized Tempo transaction.
 */
export declare function serializeTransaction(operation: TransactionOperation, options: serializeTransaction.Options): TxEnvelopeTempo.Serialized;
export declare namespace serializeTransaction {
    /** Options for `serializeTransaction`. */
    type Options = {
        /** Selected retained approvals to attach to the transaction. */
        approvals: readonly SignatureEnvelope.Serialized[];
    };
    /** Error type for `serializeTransaction`. */
    type ErrorType = from.ErrorType | InvalidOperationError | SignatureEnvelope.sortMultisigApprovals.ErrorType | TxEnvelopeTempo.deserialize.ErrorType | TxEnvelopeTempo.getSignPayload.ErrorType | TxEnvelopeTempo.serialize.ErrorType | Errors.GlobalErrorType;
}
/**
 * Validates and normalizes a multisig operation.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { MultisigOperation } from 'ox/tempo'
 *
 * const operation = MultisigOperation.from(value)
 * ```
 *
 * @param operation - Multisig operation.
 * @returns The validated operation.
 */
export declare function from<const operation extends Operation>(operation: operation): from.ReturnValue<operation>;
export declare namespace from {
    /** Return type for `from`. */
    type ReturnValue<operation extends Operation> = operation extends TransactionOperation ? TransactionOperation : KeyAuthorizationOperation;
    /** Error type for `from`. */
    type ErrorType = InvalidOperationError | Errors.GlobalErrorType;
}
/**
 * Converts a JSON-RPC multisig operation to its domain representation.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { MultisigOperation } from 'ox/tempo'
 *
 * const operation = MultisigOperation.fromRpc(value)
 * ```
 *
 * @param operation - JSON-RPC multisig operation.
 * @returns The validated operation.
 */
export declare function fromRpc<const operation extends Rpc>(operation: operation): fromRpc.ReturnValue<operation>;
export declare namespace fromRpc {
    /** Return type for `fromRpc`. */
    type ReturnValue<operation extends Rpc> = operation extends TransactionRpc ? TransactionOperation : KeyAuthorizationOperation;
    /** Error type for `fromRpc`. */
    type ErrorType = InvalidOperationError | Errors.GlobalErrorType;
}
/**
 * Converts a multisig operation to its JSON-RPC representation.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { MultisigOperation } from 'ox/tempo'
 *
 * const operationRpc = MultisigOperation.toRpc(operation)
 * ```
 *
 * @param operation - Multisig operation.
 * @returns The JSON-RPC operation.
 */
export declare function toRpc<const operation extends Operation>(operation: operation): toRpc.ReturnValue<operation>;
export declare namespace toRpc {
    /** Return type for `toRpc`. */
    type ReturnValue<operation extends Operation> = operation extends TransactionOperation ? TransactionRpc : KeyAuthorizationRpc;
    /** Error type for `toRpc`. */
    type ErrorType = from.ErrorType | MultisigConfig.toRpc.ErrorType;
}
/** Thrown when a multisig owner approval is invalid. */
export declare class InvalidApprovalError extends Errors.BaseError<Error | undefined> {
    readonly name = "MultisigOperation.InvalidApprovalError";
    /**
     * Creates an invalid multisig approval error.
     *
     * @example
     * ```ts twoslash
     * import { MultisigOperation } from 'ox/tempo'
     *
     * throw new MultisigOperation.InvalidApprovalError({
     *   reason: 'signature is from a non-owner',
     * })
     * ```
     *
     * @param options - Error options.
     */
    constructor(options?: InvalidApprovalError.Options);
}
export declare namespace InvalidApprovalError {
    /** Error construction options. */
    type Options = {
        /** Underlying error. */
        cause?: unknown | undefined;
        /** Validation failure. */
        reason?: string | undefined;
    };
}
/** Thrown when a multisig operation is malformed or internally inconsistent. */
export declare class InvalidOperationError extends Errors.BaseError<Error | undefined> {
    readonly name = "MultisigOperation.InvalidOperationError";
    /**
     * Creates an invalid multisig operation error.
     *
     * @example
     * ```ts twoslash
     * import { MultisigOperation } from 'ox/tempo'
     *
     * throw new MultisigOperation.InvalidOperationError({
     *   reason: 'hash does not match the operation payload',
     * })
     * ```
     *
     * @param options - Error options.
     */
    constructor(options?: InvalidOperationError.Options);
}
export declare namespace InvalidOperationError {
    /** Error construction options. */
    type Options = {
        /** Underlying error. */
        cause?: unknown | undefined;
        /** Validation failure. */
        reason?: string | undefined;
    };
}
//# sourceMappingURL=MultisigOperation.d.ts.map