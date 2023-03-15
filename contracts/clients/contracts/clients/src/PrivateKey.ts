import { mcl } from "@thehubbleproject/bls";
import privateKeyStorage from "./privateKeyStorage";
import SecretStorage, { SecretReference } from "./SecretStorage";

export default class PrivateKey {
  #secretReference: SecretReference;

  private constructor(secretReference: SecretReference) {
    this.#secretReference = secretReference;
  }

  // Freely create private keys and pass them around - this class doesn't
  // actually store the private key string.
  static async generateRandom(): Promise<PrivateKey> {
    await mcl.init();
    const privateKeyString = mcl.randFr().serializeToHexStr();
    const secretReference = privateKeyStorage.storeSecret(privateKeyString);

    return new PrivateKey(secretReference);
  }

  // Reading the private key requires access to privateKeyStorage, and you'll
  // only import that if you *really* need the private key.
  read(privateKeyStorage: SecretStorage<string>): string {
    return privateKeyStorage.readSecret(this.#secretReference);
  }
}
