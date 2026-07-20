import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './ui';

export function DataTable<T>({ data, columns, page = 1, totalPages = 1, onPageChange }: { data: T[]; columns: ColumnDef<T>[]; page?: number; totalPages?: number; onPageChange?: (page: number) => void }) {
  // TanStack Table owns stable internal functions; React Compiler must not memoize this hook call.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  if (!data.length) return <EmptyState />;
  return <div className="surface overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-slate-50"><tr>{table.getHeaderGroups()[0].headers.map((header) => <th key={header.id} className="border-b border-line px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr></thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="hover:bg-slate-50/80">{row.getVisibleCells().map((cell) => <td key={cell.id} className="table-cell">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div>{onPageChange && <div className="flex items-center justify-between border-t border-line px-4 py-3"><span className="text-xs text-slate-500">Page {page} of {Math.max(totalPages, 1)}</span><div className="flex gap-2"><button className="btn-secondary h-8 w-8 p-0" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button><button className="btn-secondary h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page"><ChevronRight size={15} /></button></div></div>}</div>;
}
