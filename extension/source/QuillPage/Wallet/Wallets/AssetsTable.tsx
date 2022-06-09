// TODO (merge-ok) Fix types, linting
/* eslint-disable */
// @ts-nocheck
import * as React from 'react';
import { useTable, usePagination } from 'react-table';
import {
  CurrencyEth,
  ShareNetwork,
  StopCircle,
  CurrencyDollar,
  CaretLeft,
  CaretRight,
} from 'phosphor-react';
import { TokenData } from './WalletDetail';

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
        <div className="flex gap-2 items-center">
          <StopCircle className="text-blue-500 icon-md" />
          <div className=""> 3 Tokens</div>
        </div>
      </div>
      <div className="flex gap-4 text-[13pt]">
        <div className="flex gap-2 items-center">
          <CurrencyEth className="text-blue-500 icon-md" />
          <div className="">0.937 ETH</div>
        </div>
        <div className="flex gap-2 items-center">
          <CurrencyDollar className="text-blue-500 icon-md" />
          <div className="">3,813.38 USD</div>
        </div>
      </div>
    </div>
  );
};

interface IAssetsTable {
  data: TokenData[];
}

export const AssetsTable: React.FunctionComponent<IAssetsTable> = ({
  data,
}) => {
  const columns: Array<any> = React.useMemo(
    () => [
      {
        Header: 'Token',
        accessor: 'token',
      },
      {
        Header: 'Token Value',
        accessor: 'tokenVal',
      },
      {
        Header: 'USD Value',
        accessor: 'usdVal',
      },
      {
        Header: 'Last Transaction',
        accessor: 'lastTx',
      },
      {
        Header: '',
        accessor: 'action',
      },
    ],
    [],
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    nextPage,
    previousPage,
    setPageSize,
    pageCount,
    state: { pageIndex, pageSize },
  } = useTable({ columns, data, initialState: { pageSize: 5 } }, usePagination);

  return (
    <div className="mt-4 border border-grey-300 rounded-lg border-separate">
      <TableHeader />

      <table {...getTableProps()} className="w-full">
        <thead className="text-blue-500">
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column) => (
                <th className="pb-2" {...column.getHeaderProps()}>
                  {column.render('Header')}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()} className="text-center">
          {page.map((row) => {
            prepareRow(row);
            return (
              <tr
                {...row.getRowProps()}
                className="border-y border-grey-400 last:border-b-0"
              >
                {row.cells.map((cell) => {
                  return (
                    <td className="py-3" {...cell.getCellProps()}>
                      {cell.render('Cell')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="bg-grey-100 px-4 py-2 border-t border-grey-300 flex justify-end gap-8">
        <div className="flex">
          <div>showing</div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
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
            onClick={() => previousPage()}
            className="cursor-pointer icon-md"
          />
          <div className="font-semibold">
            {pageIndex + 1} of {pageCount}
          </div>
          <CaretRight
            onClick={() => nextPage()}
            className="cursor-pointer icon-md"
          />
        </div>
      </div>
    </div>
  );
};
