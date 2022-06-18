import * as io from 'io-ts';
import deepEqual from 'fast-deep-equal';

import assert from '../helpers/assert';
import ICell from '../cells/ICell';
import TransformCell from '../cells/TransformCell';

/**
 * Controller that stores shared settings and exposes convenience methods
 */
export default class PreferencesController {
  /**
   * Name of this controller used during composition
   */
  name = 'PreferencesController';

  identities: ICell<Preferences['identities']>;

  constructor(public state: ICell<Preferences>) {
    this.identities = TransformCell.Sub(state, 'identities');
  }

  AddressPreferences(address: string): ICell<AddressPreferences | undefined> {
    return TransformCell.Sub(this.identities, address);
  }

  SelectedPreferences(): ICell<AddressPreferences> {
    const selectedAddressPromise = this.state.read().then((s) => {
      assert(s.selectedAddress !== undefined);
      return s.selectedAddress;
    });

    return new TransformCell(
      this.identities,
      async ($identities) => {
        const selectedAddress = await selectedAddressPromise;
        const prefs = $identities[selectedAddress];
        assert(prefs !== undefined);
        return prefs;
      },
      async ($identities, newPrefs) => {
        const selectedAddress = await selectedAddressPromise;
        return { ...$identities, [selectedAddress]: newPrefs };
      },
    );
  }

  /**
   * creates a new user and stores his details
   * @param address - address of the user
   *
   */
  async createUser({
    selectedCurrency,
    theme,
    locale,
    address,
  }: {
    selectedCurrency: string;
    theme: Theme;
    locale: string;
    address: string;
  }) {
    const newUserPreferences = this.AddressPreferences(address);

    assert(
      (await newUserPreferences.read()) === undefined,
      'User already exists',
    );

    const $state = await this.state.read();

    const selectedAddressPreferences =
      $state.selectedAddress && $state.identities[$state.selectedAddress];

    await newUserPreferences.write({
      ...defaultAddressPreferences,
      ...selectedAddressPreferences,
      theme,
      defaultPublicAddress: address,
      selectedCurrency,
      locale,
    });
  }

  async addContact(contact: Contact) {
    const selectedPreferences = this.SelectedPreferences();
    const $selectedPreferences = await selectedPreferences.read();

    assert(
      !$selectedPreferences.contacts.some((c) => deepEqual(c, contact)),
      'Contact already exists',
    );

    await selectedPreferences.update({
      contacts: [...$selectedPreferences.contacts, contact],
    });
  }

  async deleteContact(contact: Contact) {
    const selectedPreferences = this.SelectedPreferences();
    const { contacts } = await selectedPreferences.read();

    const newContacts = contacts.filter((c) => !deepEqual(c, contact));
    assert(newContacts.length < contacts.length, "Contact doesn't exist");

    await selectedPreferences.update({
      contacts: newContacts,
    });
  }
}

const Theme = io.union([io.literal('light'), io.literal('dark')]);
type Theme = io.TypeOf<typeof Theme>;

const Contact = io.type({
  displayName: io.string,
  publicAddress: io.string,
});

type Contact = io.TypeOf<typeof Contact>;

const CustomNft = io.type({
  nftAddress: io.string,
  chainId: io.string,
  nftContractStandard: io.string,
  nftTokenId: io.string,
});

type CustomNft = io.TypeOf<typeof CustomNft>;

const CustomToken = io.type({
  tokenAddress: io.string,
  chainId: io.string,
  tokenSymbol: io.string,
  tokenName: io.string,
  decimals: io.string,
});

type CustomToken = io.TypeOf<typeof CustomToken>;

export const AddressPreferences = io.type({
  selectedCurrency: io.string,
  locale: io.string,
  theme: Theme,
  defaultPublicAddress: io.union([io.undefined, io.string]),
  contacts: io.array(Contact),
  customTokens: io.array(CustomToken),
  customNfts: io.array(CustomNft),
});

export type AddressPreferences = io.TypeOf<typeof AddressPreferences>;

export const defaultAddressPreferences: AddressPreferences = {
  selectedCurrency: 'USD',
  locale: 'en-US',
  theme: 'dark',
  defaultPublicAddress: undefined,
  contacts: [],
  customTokens: [],
  customNfts: [],
};

export const Preferences = io.type({
  identities: io.record(
    io.string,
    io.union([io.undefined, AddressPreferences]),
  ),
  selectedAddress: io.union([io.undefined, io.string]),
  lastErrorMessage: io.union([io.undefined, io.string]),
  lastSuccessMessage: io.union([io.undefined, io.string]),
  breakOnAssertionFailures: io.union([io.undefined, io.boolean]),
});

export type Preferences = io.TypeOf<typeof Preferences>;
