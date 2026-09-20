import { MultisigConfig, MultisigOperation, } from 'ox/tempo';
import { readContract } from '../../actions/public/readContract.js';
import { writeContract } from '../../actions/wallet/writeContract.js';
import { writeContractSync } from '../../actions/wallet/writeContractSync.js';
import { parseEventLogs } from '../../utils/abi/parseEventLogs.js';
import * as Abis from '../Abis.js';
import { fromMultisig } from '../Account.js';
import * as Addresses from '../Addresses.js';
import { defineCall } from '../internal/utils.js';
/**
 * Gets the current cached config for a multisig account.
 *
 * The coordinator reads the account's current onchain commitment and returns
 * the matching config from its store. It returns `null` when the config is not
 * cached.
 *
 * @example
 * ```ts
 * const config = await client.multisig.getConfig({
 *   address: '0x...',
 * })
 * ```
 *
 * @param client - Client.
 * @param parameters - Parameters.
 * @returns The config, or `null` when it is unknown.
 */
export async function getConfig(client, parameters) {
    const config = await client.request({
        method: 'multisig_getConfig',
        params: [{ address: parameters.address }],
    });
    return config ? MultisigConfig.fromRpc(config) : null;
}
/**
 * Gets the current configuration commitment for a native multisig account.
 *
 * @example
 * ```ts
 * import { createClient, http } from 'viem'
 * import { tempo } from 'viem/chains'
 * import { Actions } from 'viem/tempo'
 *
 * const client = createClient({
 *   chain: tempo,
 *   transport: http(),
 * })
 *
 * const commitment = await Actions.multisig.getConfigCommitment(client, {
 *   account: '0x...',
 * })
 * ```
 *
 * @param client - Client.
 * @param parameters - Parameters.
 * @returns The current configuration commitment, or zero when no config has
 * been committed.
 */
export async function getConfigCommitment(client, parameters) {
    const { account, ...rest } = parameters;
    return readContract(client, {
        ...rest,
        ...getConfigCommitment.call({ account }),
    });
}
(function (getConfigCommitment) {
    /**
     * Defines a call to the `getConfigCommitment` function.
     *
     * Can be passed to [`multicall`](https://viem.sh/docs/contract/multicall).
     *
     * @param args - Arguments.
     * @returns The call.
     */
    function call(args) {
        return defineCall({
            address: Addresses.nativeMultisig,
            abi: Abis.nativeMultisig,
            args: [args.account],
            functionName: 'getConfigCommitment',
        });
    }
    getConfigCommitment.call = call;
})(getConfigCommitment || (getConfigCommitment = {}));
/**
 * Gets a coordinated multisig operation by its hash.
 *
 * @param client - Client.
 * @param parameters - Parameters.
 * @returns The operation, or `null` when it is unknown.
 */
export async function getOperation(client, parameters) {
    const operation = await client.request({
        method: 'multisig_getOperation',
        params: [parameters.hash],
    });
    return operation ? MultisigOperation.fromRpc(operation) : null;
}
/**
 * Replaces the current configuration for a native multisig account.
 *
 * The transaction must be authorized directly by the account's current owner
 * quorum. Local owner-signing flows can include {@link updateConfig.call} in a
 * prepared transaction before collecting approvals.
 *
 * @example
 * ```ts
 * import { createClient, http } from 'viem'
 * import { sendTransactionSync } from 'viem/actions'
 * import { tempoLocalnet } from 'viem/chains'
 * import { Account, Actions } from 'viem/tempo'
 *
 * const owner = Account.fromSecp256k1(
 *   '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
 * )
 * const account = Account.fromMultisig({
 *   address: 'infer',
 *   owners: [owner],
 * })
 * const client = createClient({
 *   chain: tempoLocalnet,
 *   transport: http(),
 * })
 *
 * await sendTransactionSync(client, {
 *   account,
 *   to: account.address,
 * })
 *
 * const hash = await Actions.multisig.updateConfig(client, {
 *   account,
 *   nextConfig: {
 *     owners: [{ owner: owner.address, weight: 1 }],
 *     threshold: 1,
 *   },
 * })
 * ```
 *
 * @param client - Client.
 * @param parameters - Parameters.
 * @returns The transaction hash.
 */
export async function updateConfig(client, parameters) {
    return updateConfig.inner(writeContract, client, parameters);
}
(function (updateConfig) {
    /** @internal */
    async function inner(action, client, parameters) {
        const { account: account_, currentConfig: currentConfig_, nextConfig, ...rest } = parameters;
        const accountValue = account_ ?? client.account;
        const account = (() => {
            if (typeof accountValue === 'object' &&
                accountValue.source === 'multisig')
                return accountValue;
            return undefined;
        })();
        const config = (() => {
            if (currentConfig_)
                return currentConfig_;
            if (account?.config)
                return account.config;
            return undefined;
        })();
        const address = (() => {
            if (account)
                return account.address;
            if (typeof accountValue === 'string')
                return accountValue;
            if (accountValue)
                return accountValue.address;
            return undefined;
        })();
        const currentConfig = await (async () => {
            if (config)
                return MultisigConfig.from(config);
            if (!address)
                throw new Error('A multisig account address or current config is required.');
            const cachedConfig = await getConfig(client, { address });
            if (!cachedConfig)
                throw new Error(`No current multisig config is cached for account ${address}. Provide the current config.`);
            return cachedConfig;
        })();
        const resolvedAccount = (() => {
            if (account)
                return { ...account, config: currentConfig };
            if (typeof accountValue === 'object')
                return accountValue;
            if (address)
                return fromMultisig({ address, ...currentConfig });
            return undefined;
        })();
        return (await action(client, {
            ...rest,
            ...(resolvedAccount ? { account: resolvedAccount } : {}),
            ...updateConfig.call({ currentConfig, nextConfig }),
        }));
    }
    updateConfig.inner = inner;
    /**
     * Defines a call to the `updateConfig` function.
     *
     * Can be passed as a parameter to:
     * - [`estimateContractGas`](https://viem.sh/docs/contract/estimateContractGas): estimate gas
     * - [`simulateContract`](https://viem.sh/docs/contract/simulateContract): simulate the update
     * - [`sendCalls`](https://viem.sh/docs/actions/wallet/sendCalls): include the update in a call batch
     *
     * @example
     * ```ts
     * import { Actions, type MultisigConfig } from 'viem/tempo'
     *
     * declare const currentConfig: MultisigConfig.Config
     *
     * const call = Actions.multisig.updateConfig.call({
     *   currentConfig,
     *   nextConfig: {
     *     owners: [{ owner: '0x...', weight: 1 }],
     *     threshold: 1,
     *   },
     * })
     * ```
     *
     * @param args - Current and replacement multisig configurations.
     * @returns The call.
     */
    function call(args) {
        const currentConfig = MultisigConfig.from(args.currentConfig);
        const nextConfig = MultisigConfig.from({
            owners: args.nextConfig.owners,
            salt: currentConfig.salt,
            threshold: args.nextConfig.threshold,
            version: currentConfig.version + 1n,
        });
        return defineCall({
            address: Addresses.nativeMultisig,
            abi: Abis.nativeMultisig,
            args: [currentConfig, nextConfig.threshold, nextConfig.owners],
            functionName: 'updateConfig',
        });
    }
    updateConfig.call = call;
    /**
     * Extracts the `MultisigConfigUpdated` event from logs.
     *
     * @param logs - Transaction logs.
     * @returns The configuration update event.
     */
    function extractEvent(logs) {
        const [log] = parseEventLogs({
            abi: Abis.nativeMultisig,
            logs,
            eventName: 'MultisigConfigUpdated',
            strict: true,
        });
        if (!log)
            throw new Error('`MultisigConfigUpdated` event not found.');
        return log;
    }
    updateConfig.extractEvent = extractEvent;
})(updateConfig || (updateConfig = {}));
/**
 * Replaces a native multisig configuration and waits for confirmation.
 *
 * @example
 * ```ts
 * import { createWalletClient, custom, type EIP1193Provider } from 'viem'
 * import { tempo } from 'viem/chains'
 * import { Actions, type MultisigConfig } from 'viem/tempo'
 *
 * declare const provider: EIP1193Provider
 * declare const currentConfig: MultisigConfig.Config
 *
 * const client = createWalletClient({
 *   account: '0x...',
 *   chain: tempo,
 *   transport: custom(provider),
 * })
 *
 * const { receipt } = await Actions.multisig.updateConfigSync(client, {
 *   currentConfig,
 *   nextConfig: {
 *     owners: [{ owner: '0x...', weight: 1 }],
 *     threshold: 1,
 *   },
 * })
 * ```
 *
 * @param client - Client.
 * @param parameters - Parameters.
 * @returns The updated configuration event and transaction receipt.
 */
export async function updateConfigSync(client, parameters) {
    const { throwOnReceiptRevert = true, ...rest } = parameters;
    const receipt = await updateConfig.inner(writeContractSync, client, {
        ...rest,
        throwOnReceiptRevert,
    });
    if (receipt.status === 'pending')
        return { receipt };
    const { args } = updateConfig.extractEvent(receipt.logs);
    return {
        account: args.account,
        config: MultisigConfig.from({
            owners: args.owners,
            salt: args.salt,
            threshold: args.threshold,
            version: args.version,
        }),
        receipt,
    };
}
//# sourceMappingURL=multisig.js.map