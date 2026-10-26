import type { ReactNode } from "react";

export type Column<T> = {
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "No rows for this range.",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <div className="empty-inline">{empty}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                className={[
                  column.align === "right" ? "is-right" : "",
                  column.className ?? "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={[
                    column.align === "right" ? "is-right" : "",
                    column.className ?? "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
