import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import {
  CurrencyEth,
  ShareNetwork,
  StopCircle,
  CurrencyDollar,
  CaretLeft,
  CaretRight,
} from 'phosphor-react';

import type { TokenData } from './WalletDetail';
import onAction from '../../../helpers/onAction';
import DisplayNonce from './DisplayNonce';
import useCell from '../../../cells/useCell';
import { useQuill } from '../../../QuillContext';
import Loading from '../../../components/Loading';
import { QuillTransaction } from '../../../types/Rpc';

export const TableHeader: React.FunctionComponent = () => {
  return (
    <div className="flex justify-between p-6">
      <div className="flex gap-4">
        <div className="flex gap-2 items-center">
          <ShareNetwork className="text-blue-500 icon-md" />
          <div className="">
            <span className="text-blue-500">Network :</span> Mainnet
          </div>
        </div>
      </div>
      <div className="flex gap-4 text-[13pt]">
        <div className="flex gap-2 items-center">
          <CurrencyEth className="text-blue-500 icon-md" />
          <div className="">0.937 ETH</div>
        </div>
        <div className="flex gap-2 items-center text-disclaimer">
          <CurrencyDollar className="text-blue-500 icon-md" />
          <div className="">3,813.38 USD</div>
        </div>
      </div>
    </div>
  );
};

interface ITransactionsTable {
  selectedAddress: string;
}

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
        accessorKey: 'createdAt',
      },
      {
        header: 'From',
        accessorKey: 'from',
      },
      {
        header: 'Status',
        accessorKey: 'status',
      },
    ],
    [],
  );

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 5 } },
  });

  if (data === undefined || transactions === undefined) {
    return <Loading />;
  }

  return (
    <div>
      Total: <DisplayNonce address={selectedAddress} />
      <div className="mt-4 border border-grey-300 rounded-lg border-separate">
        <TableHeader />

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
                      <td key={cell.id} className="py-3">
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

        {/* <div className="bg-grey-100 px-4 py-2 border-t border-grey-300 flex justify-end gap-8">
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
        </div> */}
      </div>
    </div>
  );
};
