import { SignatureEnvelope } from 'ox/tempo';
/** Parses a primitive multisig owner approval. */
export function parseApproval(signature) {
    const approval = SignatureEnvelope.from(signature);
    if (approval.type === 'multisig' || approval.type === 'keychain')
        throw new Error('Multisig owners must use primitive signatures.');
    return approval;
}
//# sourceMappingURL=Signature.js.map