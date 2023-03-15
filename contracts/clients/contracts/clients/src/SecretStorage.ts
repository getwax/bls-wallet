export type SecretReference = {
  type: "secret-reference";
  name?: string;
};

export default class SecretStorage<T> {
  #secrets = new WeakMap<SecretReference, T>();

  storeSecret(secret: T, name?: string): SecretReference {
    const secretReference: SecretReference = { type: "secret-reference", name };
    this.#secrets.set(secretReference, secret);

    return secretReference;
  }

  readSecret(secretReference: SecretReference): T {
    const secret = this.#secrets.get(secretReference);

    if (secret === undefined) {
      throw new Error(`Secret ${secretReference.name} not found`);
    }

    return secret;
  }
}
