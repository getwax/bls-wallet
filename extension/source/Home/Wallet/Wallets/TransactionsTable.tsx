import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import {
  CaretLeft,
  CaretRight,
  ArrowUpRight,
  UserCircle,
} from 'phosphor-react';

import { ethers } from 'ethers';
import onAction from '../../../helpers/onAction';
import DisplayNonce from './DisplayNonce';
import useCell from '../../../cells/useCell';
import { useQuill } from '../../../QuillContext';
import Loading from '../../../components/Loading';
import { QuillTransaction } from '../../../types/Rpc';
import formatCompactAddress from '../../../helpers/formatCompactAddress';
import ActionsModal from './ActionsModal';

interface ITransactionsTable {
  selectedAddress: string;
}

export const TableHeader: React.FunctionComponent<ITransactionsTable> = ({
  selectedAddress,
}) => {
  return (
    <div className="flex justify-between p-6">
      <div className="flex gap-4">
        <div className="flex gap-2 items-center">
          <UserCircle className="text-blue-500 icon-md" />
          <div className="">
            <span className="text-blue-500">From :</span>{' '}
            {formatCompactAddress(selectedAddress)}
          </div>
        </div>
      </div>
    </div>
  );
};

const TransactionTableCell = (cell: { getValue: () => string }) => {
  return (
    <div
      className={[
        'bg-blue-100',
        'bg-opacity-40',
        'px-3',
        'm-auto',
        'flex',
        'items-center',
        'gap-2',
        'active:bg-opacity-70',
        'cursor-pointer',
        'text-blue-600',
        'rounded-full',
        'w-max',
      ].join(' ')}
      {...onAction(() =>
        window.open(`https://etherscan.io/tx/${cell.getValue()}`),
      )}
    >
      {formatCompactAddress(cell.getValue())}
      <ArrowUpRight />
    </div>
  );
};

export const TransactionsTable: React.FunctionComponent<ITransactionsTable> = ({
  selectedAddress,
}) => {
  const quill = useQuill();
  const transactions = useCell(quill.cells.transactions);
  const data =
    transactions?.outgoing.filter((t) => t.from === selectedAddress) || [];

  const columns = React.useMemo<ColumnDef<QuillTransaction>[]>(
    () => [
      {
        header: 'Created at',
        accessorFn: (t) =>
          new Intl.DateTimeFormat([], {
            timeStyle: 'short',
            dateStyle: 'medium',
          }).format(t.createdAt),
      },
      {
        header: 'Network',
        accessorKey: 'chainId',
        // TODO - show network name instead of id
      },
      {
        header: 'Value',
        accessorFn: (t) => {
          const total = t.actions.reduce(
            (acc, cur) => acc.add(ethers.BigNumber.from(cur.value)),
            ethers.BigNumber.from(0),
          );
          return ethers.utils.formatEther(total);
        },
      },
      {
        header: 'Status',
        accessorKey: 'status',
      },
      {
        header: 'Tx Hash',
        accessorFn: (t) => {
          return t.txHash;
        },
        cell: TransactionTableCell,
      },
      {
        header: 'Actions',
        accessorKey: 'actions',
        cell: ActionsModal,
      },
    ],
    [],
  );

  const table = useReactTable({
    columns,
    data: data.reverse(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 5 } },
  });

  if (data === undefined || transactions === undefined) {
    return <Loading />;
  }

  return (
    <div>
      Nonce: <DisplayNonce address={selectedAddress} />
      <div className="mt-4 border border-grey-300 rounded-lg border-separate">
        <TableHeader selectedAddress={selectedAddress} />

        <table className="w-full">
          <thead className="text-blue-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th className="pb-2" key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <div>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="text-center">
            {table.getRowModel().rows.map((row) => {
              return (
                <tr
                  key={row.id}
                  className="border-y border-grey-400 last:border-b-0"
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <td key={cell.id} className="py-3 text-[10pt]">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
          className={[
            'bg-grey-100',
            'px-4',
            'py-2',
            'border-t',
            'border-grey-300',
            'flex',
            'justify-end',
            'gap-8',
          ].join(' ')}
        >
          <div className="flex">
            <div>showing</div>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
              className="text-blue-500"
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} results
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <CaretLeft
              {...onAction(() => table.previousPage())}
              className="cursor-pointer icon-md"
            />
            <div className="font-semibold">
              {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </div>
            <CaretRight
              {...onAction(() => table.nextPage())}
              className="cursor-pointer icon-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
