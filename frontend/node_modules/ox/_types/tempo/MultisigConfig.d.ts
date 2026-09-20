import * as Address from '../core/Address.js';
import type * as Bytes from '../core/Bytes.js';
import * as ContractAddress from '../core/ContractAddress.js';
import * as Errors from '../core/Errors.js';
import * as Hash from '../core/Hash.js';
import * as Hex from '../core/Hex.js';
import type { Compute } from '../core/internal/types.js';
/** Maximum encoded byte length for one primitive owner approval. */
export declare const maxOwnerSignatureBytes = 2049;
/** Maximum number of owners allowed in a native multisig config. */
export declare const maxOwners = 48;
/** Maximum number of owner approvals in a native multisig signature. */
export declare const maxSignatures = 8;
/** Maximum threshold accepted by a native multisig config. */
export declare const maxThreshold = 8;
/** Maximum version accepted by a native multisig config. */
export declare const maxVersion: bigint;
/** Tempo signature type byte for native multisig signatures. */
export declare const signatureTypeByte: "0x05";
/** Zero 32-byte salt (the default when no salt is provided). */
export declare const zeroSalt: `0x${string}`;
/**
 * Complete native multisig configuration witness.
 */
export type Config<bigintType = bigint, numberType = number> = Compute<{
    /** Weighted owner list, strictly ascending by owner address. */
    owners: readonly Owner<numberType>[];
    /** Caller-chosen 32-byte salt. */
    salt: Hex.Hex;
    /** Minimum total owner weight required for authorization. */
    threshold: numberType;
    /** Configuration version. Zero identifies the initial configuration. */
    version: bigintType;
}>;
/** Input accepted when constructing a native multisig configuration. */
export type Input<versionType extends bigint | number = bigint | number, numberType = number> = Compute<{
    /** Weighted owner list (strictly ascending by `owner` address). */
    owners: readonly Owner<numberType>[];
    /**
     * Caller-chosen 32-byte salt mixed into the derived account address.
     * Defaults to the zero salt (`MultisigConfig.zeroSalt`) when omitted.
     */
    salt?: Hex.Hex | undefined;
    /** Minimum total owner weight required to authorize a transaction. */
    threshold: numberType;
    /** Configuration version as a safe integer or bigint. Defaults to `0n`. */
    version?: versionType | undefined;
}>;
/** Native multisig owner entry. */
export type Owner<numberType = number> = {
    /** Owner address (recovered from the owner's approval). */
    owner: Address.Address;
    /** Nonzero owner weight. */
    weight: numberType;
};
/** JSON-RPC representation of a native multisig configuration. */
export type Rpc = Config<Hex.Hex, number>;
/** RLP tuple representation of a {@link ox#MultisigConfig.Config}. */
export type Tuple = readonly [
    salt: Hex.Hex,
    version: Hex.Hex,
    threshold: Hex.Hex,
    owners: readonly Hex.Hex[][]
];
/**
 * Asserts that a native multisig {@link ox#MultisigConfig.Config} is valid.
 *
 * Mirrors the Tempo configuration rules: owners non-empty and
 * `<= maxOwners`, strictly ascending unique nonzero owner addresses, nonzero
 * integer owner weights, integer `threshold` between `1` and `maxThreshold`,
 * total weight `<= 255` (u8 max), and a threshold reachable by at most
 * `maxSignatures` owners.
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig } from 'ox/tempo'
 *
 * MultisigConfig.assert({
 *   threshold: 1,
 *   owners: [
 *     { owner: '0x1111111111111111111111111111111111111111', weight: 1 },
 *   ],
 * })
 * ```
 *
 * @param config - The multisig config.
 */
export declare function assert<versionType extends bigint | number = bigint | number, numberType = number>(config: Input<versionType, numberType>): void;
export declare namespace assert {
    type ErrorType = InvalidConfigError | Errors.GlobalErrorType;
}
/**
 * Normalizes a native multisig {@link ox#MultisigConfig.Config}.
 *
 * Sorts owners into strictly ascending `owner` address order (the canonical
 * form required for account derivation) and asserts the config is valid.
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig } from 'ox/tempo'
 *
 * const config = MultisigConfig.from({
 *   owners: [
 *     { owner: '0x2222222222222222222222222222222222222222', weight: 1 },
 *     { owner: '0x1111111111111111111111111111111111111111', weight: 1 },
 *   ],
 *   threshold: 2,
 * })
 * // owners are now sorted ascending by address
 * ```
 *
 * @param config - The multisig config.
 * @returns The normalized multisig config.
 */
export declare function from<numberType = number>(config: Input<0 | 0n, numberType> & {
    version?: 0 | 0n | undefined;
}): Config<0n, numberType>;
export declare function from<bigintType extends bigint, numberType = number>(config: Input<bigintType, numberType> & {
    version: bigintType;
}): Config<bigintType, numberType>;
export declare function from<numberType = number>(config: Input<number, numberType> & {
    version: number;
}): Config<bigint, numberType>;
export declare function from<numberType = number>(config: Input<bigint | number, numberType>): Config<bigint, numberType>;
/**
 * Converts a JSON-RPC multisig configuration to its domain representation.
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig } from 'ox/tempo'
 *
 * const config = MultisigConfig.fromRpc({
 *   owners: [
 *     { owner: '0x1111111111111111111111111111111111111111', weight: 1 },
 *   ],
 *   salt: `0x${'00'.repeat(32)}`,
 *   threshold: 1,
 *   version: '0x0',
 * })
 * ```
 *
 * @param config - The JSON-RPC multisig configuration.
 * @returns The normalized multisig configuration.
 */
export declare function fromRpc(config: Rpc): Config;
export declare namespace fromRpc {
    type ErrorType = assert.ErrorType | Hex.toBigInt.ErrorType | Errors.GlobalErrorType;
}
/**
 * Converts an RLP {@link ox#MultisigConfig.Tuple} back to a
 * {@link ox#MultisigConfig.Config}.
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig } from 'ox/tempo'
 *
 * const config = MultisigConfig.fromTuple([
 *   `0x${'00'.repeat(32)}`,
 *   '0x',
 *   '0x01',
 *   [['0x1111111111111111111111111111111111111111', '0x01']],
 * ])
 * ```
 *
 * @param tuple - The RLP tuple.
 * @returns The multisig config.
 */
export declare function fromTuple(tuple: Tuple): Config;
/**
 * Derives the stable native multisig account address.
 *
 * The initial config is hashed into a CREATE2 salt using fixed-width
 * big-endian fields, not RLP. The account uses the chain-configured recovery
 * factory and wallet init-code hash.
 *
 * The address is derived once from the initial version-0 config. Config
 * updates do not change it.
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig } from 'ox/tempo'
 *
 * const initialConfig = MultisigConfig.from({
 *   owners: [
 *     { owner: '0x1111111111111111111111111111111111111111', weight: 1 },
 *   ],
 *   threshold: 1,
 * })
 *
 * const address = MultisigConfig.getAddress(initialConfig, {
 *   factory: '0x7171717171717171717171717171717171717171'
 * })
 * ```
 *
 * @param config - The initial multisig config.
 * @param options - The recovery factory configured by the chain.
 * @returns The multisig account address.
 */
export declare function getAddress(config: Input, options: getAddress.Options): Address.Address;
export declare namespace getAddress {
    type Options = {
        /** Recovery factory configured by the chain. */
        factory: Address.Address;
    };
    type ErrorType = assert.ErrorType | ContractAddress.fromCreate2.ErrorType | Hash.keccak256.ErrorType | Hex.concat.ErrorType | Hex.fromNumber.ErrorType | Hex.fromString.ErrorType | Errors.GlobalErrorType;
}
/**
 * Computes the commitment for a native multisig configuration.
 *
 * The commitment uses raw fixed-width fields, not RLP or ABI encoding:
 * `keccak256("tempo:multisig:config" || salt || uint64be(version) || uint8(threshold) || uint8(owners.length) || owners)`.
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig } from 'ox/tempo'
 *
 * const commitment = MultisigConfig.getCommitment({
 *   owners: [
 *     { owner: '0x1111111111111111111111111111111111111111', weight: 1 },
 *   ],
 *   threshold: 1,
 *   version: 1n,
 * })
 * ```
 *
 * @param config - The complete multisig configuration.
 * @returns The configuration commitment.
 */
export declare function getCommitment(config: Input): Hex.Hex;
export declare namespace getCommitment {
    type ErrorType = assert.ErrorType | Hash.keccak256.ErrorType | Hex.concat.ErrorType | Hex.fromNumber.ErrorType | Hex.fromString.ErrorType | Errors.GlobalErrorType;
}
/**
 * Computes the digest a native multisig owner approves (signs).
 *
 * `keccak256("tempo:multisig:signature" || inner_digest || account || uint64be(version))`,
 * where `inner_digest` is the transaction sign payload
 * ({@link ox#TxEnvelopeTempo.(getSignPayload:function)}).
 *
 * The digest is keyed on the permanent `account` and the supplied config
 * version. Initial approvals use version `0n`; each config update increments
 * it.
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig, TxEnvelopeTempo } from 'ox/tempo'
 *
 * const config = MultisigConfig.from({
 *   owners: [
 *     { owner: '0x1111111111111111111111111111111111111111', weight: 1 },
 *   ],
 *   threshold: 1,
 * })
 *
 * const envelope = TxEnvelopeTempo.from({
 *   chainId: 1,
 *   calls: [],
 * })
 *
 * const digest = MultisigConfig.getSignPayload({
 *   account: MultisigConfig.getAddress(config, {
 *     factory: '0x7171717171717171717171717171717171717171'
 *   }),
 *   config,
 *   payload: TxEnvelopeTempo.getSignPayload(envelope),
 * })
 * ```
 *
 * @param value - The digest derivation parameters.
 * @returns The owner approval digest.
 */
export declare function getSignPayload(value: getSignPayload.Value): Hex.Hex;
export declare namespace getSignPayload {
    type Value = {
        /** The native multisig account address. */
        account: Address.Address;
        /** Configuration whose version applies to the approval. */
        config: Pick<Config<bigint | number>, 'version'>;
        /** The inner transaction sign payload (`tx.signature_hash()`). */
        payload: Hex.Hex | Bytes.Bytes;
    };
    type ErrorType = assert.ErrorType | Hash.keccak256.ErrorType | Hex.concat.ErrorType | Hex.from.ErrorType | Hex.fromNumber.ErrorType | Errors.GlobalErrorType;
}
/**
 * Converts a multisig configuration to its JSON-RPC representation.
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig } from 'ox/tempo'
 *
 * const config = MultisigConfig.toRpc({
 *   owners: [
 *     { owner: '0x1111111111111111111111111111111111111111', weight: 1 },
 *   ],
 *   threshold: 1,
 * })
 * ```
 *
 * @param config - The multisig configuration.
 * @returns The JSON-RPC multisig configuration.
 */
export declare function toRpc(config: Input): Rpc;
export declare namespace toRpc {
    type ErrorType = assert.ErrorType | Hex.fromNumber.ErrorType | Errors.GlobalErrorType;
}
/**
 * Converts a {@link ox#MultisigConfig.Config} to its RLP tuple form.
 *
 * Tuple shape: `[salt, version, threshold, [[owner, weight], ...]]`. The
 * 32-byte `salt` encodes as a full fixed-width string; other integers use
 * canonical RLP encoding (zero values encode as `0x`).
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig } from 'ox/tempo'
 *
 * const tuple = MultisigConfig.toTuple({
 *   owners: [
 *     { owner: '0x1111111111111111111111111111111111111111', weight: 1 },
 *   ],
 *   threshold: 1,
 * })
 * ```
 *
 * @param config - The multisig config.
 * @returns The RLP tuple.
 */
export declare function toTuple(config: Input): Tuple;
/**
 * Validates a native multisig {@link ox#MultisigConfig.Config}. Returns `true`
 * if valid, `false` otherwise.
 *
 * @example
 * ```ts twoslash
 * import { MultisigConfig } from 'ox/tempo'
 *
 * const valid = MultisigConfig.validate({
 *   owners: [
 *     { owner: '0x1111111111111111111111111111111111111111', weight: 1 },
 *   ],
 *   threshold: 1,
 * })
 * // @log: true
 * ```
 *
 * @param config - The multisig config.
 * @returns Whether the config is valid.
 */
export declare function validate(config: Input): boolean;
/** Thrown when a native multisig config is invalid. */
export declare class InvalidConfigError extends Errors.BaseError {
    readonly name = "MultisigConfig.InvalidConfigError";
    constructor({ reason }: {
        reason: string;
    });
}
//# sourceMappingURL=MultisigConfig.d.ts.map