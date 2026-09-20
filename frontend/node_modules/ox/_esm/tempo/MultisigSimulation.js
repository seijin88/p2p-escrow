import * as Address from '../core/Address.js';
import * as Errors from '../core/Errors.js';
import * as Hex from '../core/Hex.js';
import * as Rlp from '../core/Rlp.js';
import * as MultisigConfig from './MultisigConfig.js';
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
export function fromRpc(spec) {
    const { approvals, config } = spec;
    assertApprovals(approvals);
    return { approvals, config: deserializeConfig(config) };
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
export function toRpc(spec) {
    const { approvals, config } = spec;
    assertApprovals(approvals);
    return {
        approvals: approvals.map(({ keyData, keyType, owner }) => ({
            ...(keyData !== undefined ? { keyData: shimKeyData(keyData) } : {}),
            ...(keyType !== undefined ? { keyType } : {}),
            owner,
        })),
        config: serializeConfig(config),
    };
}
/** @internal */
function assertApprovals(approvals) {
    if (approvals.some((approval) => typeof approval !== 'object' ||
        approval === null ||
        'spec' in approval ||
        'type' in approval))
        throw new InvalidSimulationError({
            reason: 'only untagged primitive owner approvals are allowed',
        });
    if (approvals.length > MultisigConfig.maxSignatures)
        throw new InvalidSimulationError({
            reason: `approval count exceeds ${MultisigConfig.maxSignatures}`,
        });
}
/** @internal */
function deserializeConfig(config) {
    const tuple = Rlp.toHex(config);
    if (!Array.isArray(tuple) || tuple.length !== 4)
        throw new InvalidSimulationError({ reason: 'invalid config encoding' });
    const [salt, version, threshold, owners] = tuple;
    if (Array.isArray(salt) ||
        Hex.size(salt) !== 32 ||
        Array.isArray(version) ||
        Hex.size(version) > 8 ||
        (version !== '0x' && Hex.slice(version, 0, 1) === '0x00') ||
        Array.isArray(threshold) ||
        Hex.size(threshold) > 1 ||
        !Array.isArray(owners) ||
        owners.some((owner) => !Array.isArray(owner) ||
            owner.length !== 2 ||
            owner.some(Array.isArray) ||
            !Address.validate(owner[0]) ||
            Hex.size(owner[1]) > 1))
        throw new InvalidSimulationError({ reason: 'invalid config encoding' });
    const value = MultisigConfig.fromTuple(tuple);
    MultisigConfig.assert(value);
    if (!Hex.isEqual(config, serializeConfig(value)))
        throw new InvalidSimulationError({ reason: 'noncanonical config encoding' });
    return value;
}
/** @internal */
function serializeConfig(config) {
    return Rlp.fromHex(MultisigConfig.toTuple(config));
}
/**
 * Shims long key data into the length hint accepted by Tempo's gas estimator.
 * @internal
 */
function shimKeyData(data) {
    const size = Hex.size(data);
    if (size <= 4)
        return data;
    return Hex.fromNumber(size, { size: 2 });
}
/** Thrown when a native multisig simulation spec is invalid. */
export class InvalidSimulationError extends Errors.BaseError {
    constructor(options) {
        super(`Invalid multisig simulation: ${options.reason}.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MultisigSimulation.InvalidSimulationError'
        });
    }
}
//# sourceMappingURL=MultisigSimulation.js.map