import * as Address from '../core/Address.js';
import * as Errors from '../core/Errors.js';
import * as Hex from '../core/Hex.js';
import type { Compute } from '../core/internal/types.js';
import * as Rlp from '../core/Rlp.js';
import * as MultisigConfig from './MultisigConfig.js';
import type * as SignatureEnvelope from './SignatureEnvelope.js';
/** Native multisig owner approval used for RPC simulation. */
export type Approval = PrimitiveApproval;
/** JSON-RPC native multisig owner approval used for RPC simulation. */
export type ApprovalRpc = PrimitiveApproval;
/** Primitive owner approval used for RPC simulation. */
export type PrimitiveApproval = {
    /** Optional signature-specific gas-estimation data. */
    keyData?: Hex.Hex | undefined;
    /** Signature type to model. Omission uses a maximum-size WebAuthn signature. */
    keyType?: SignatureEnvelope.Type | undefined;
    /** Configured owner address. */
    owner: Address.Address;
};
/** JSON-RPC representation of a native multisig simulation spec. */
export type Rpc = Compute<{
    /** Owner approvals to model. */
    approvals: readonly ApprovalRpc[];
    /** Canonical RLP-encoded applicable configuration. */
    config: Hex.Hex;
}>;
/** Native multisig spec used to construct an RPC simulation signature. */
export type Spec = Compute<{
    /** Owner approvals to model. */
    approvals: readonly Approval[];
    /** Complete applicable configuration. */
    config: MultisigConfig.Config;
}>;
/**
 * Converts a JSON-RPC multisig simulation spec to its domain representation.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { MultisigSimulation } from 'ox/tempo'
 *
 * const spec = MultisigSimulation.fromRpc(specRpc)
 * ```
 *
 * @param spec - JSON-RPC multisig simulation spec.
 * @returns The multisig simulation spec with decoded configurations.
 */
export declare function fromRpc(spec: Rpc): Spec;
export declare namespace fromRpc {
    /** Error type for `fromRpc`. */
    type ErrorType = Hex.isEqual.ErrorType | InvalidSimulationError | MultisigConfig.assert.ErrorType | Rlp.fromHex.ErrorType | Rlp.toHex.ErrorType | Errors.GlobalErrorType;
}
/**
 * Converts a multisig simulation spec to its JSON-RPC representation.
 *
 * @example
 * ```ts twoslash
 * // @noErrors
 * import { MultisigSimulation } from 'ox/tempo'
 *
 * const specRpc = MultisigSimulation.toRpc(spec)
 * ```
 *
 * @param spec - Multisig simulation spec.
 * @returns The JSON-RPC multisig simulation spec with encoded configurations.
 */
export declare function toRpc(spec: Spec): Rpc;
export declare namespace toRpc {
    /** Error type for `toRpc`. */
    type ErrorType = Hex.fromNumber.ErrorType | InvalidSimulationError | MultisigConfig.assert.ErrorType | Rlp.fromHex.ErrorType | Errors.GlobalErrorType;
}
/** Thrown when a native multisig simulation spec is invalid. */
export declare class InvalidSimulationError extends Errors.BaseError {
    readonly name = "MultisigSimulation.InvalidSimulationError";
    constructor(options: InvalidSimulationError.Options);
}
export declare namespace InvalidSimulationError {
    /** Error construction options. */
    type Options = {
        /** Validation failure. */
        reason: string;
    };
}
//# sourceMappingURL=MultisigSimulation.d.ts.map