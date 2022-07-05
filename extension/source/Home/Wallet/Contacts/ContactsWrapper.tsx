import * as React from 'react';
import { ContactsSummary } from './ContactsSummary';

export interface IContacts {
  name: string;
}

const contacts: IContacts[] = [
  {
    name: 'Andrew Hargreaves',
  },
  {
    name: 'Angie Johnson',
  },
  {
    name: 'Mom',
  },
];

export const ContactsWrapper: React.FunctionComponent = () => {
  const [selected, setSelected] = React.useState<number>(0);

  return (
    <div className="">
      <div className="flex justify-between place-items-center">
        <div className="text-body">Contacts</div>
      </div>

      <div className="flex flex-col gap-6 mt-8">
        {contacts.map((contact, index) => (
          <ContactsSummary
            onAction={() => setSelected(index)}
            name={contact.name}
            key={contact.name}
            expanded={index === selected}
          />
        ))}
      </div>
    </div>
  );
};
