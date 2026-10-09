"use client";
import { Empty, Pagination, Table, Text } from "@cloudflare/kumo";
import { ReactNode, useState } from "react";
export type DataColumn<T> = { title: string; render: (row: T) => ReactNode };
/** A single table preserves every value and action when rows reflow on narrow screens. */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  empty,
  perPage = 15,
}: {
  rows: T[];
  columns: DataColumn<T>[];
  empty?: string;
  perPage?: number;
}) {
  const [page, setPage] = useState(1);
  const actual = Math.min(page, Math.max(1, Math.ceil(rows.length / perPage)));
  if (!rows.length)
    return (
      <Empty
        className="empty"
        title="Belum ada data"
        description={empty ?? "Tambahkan data untuk memulai alur kerja."}
      />
    );
  return (
    <div className="data-collection">
      <div className="table-scroll">
        <Table className="responsive-table">
          <Table.Header>
            <Table.Row>
              {columns.map((c, index) => (
                <Table.Head key={index}>{c.title || "Aksi"}</Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.slice((actual - 1) * perPage, actual * perPage).map((row) => (
              <Table.Row key={row.id}>
                {columns.map((c, index) => (
                  <Table.Cell
                    key={index}
                    className={!c.title ? "action-cell" : undefined}
                  >
                    <Text
                      as="span"
                      variant="secondary"
                      DANGEROUS_className="mobile-field-label"
                      aria-hidden="true"
                    >
                      {c.title || "Aksi"}
                    </Text>
                    <div className="cell-content">{c.render(row)}</div>
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      <Pagination
        className="table-footer"
        page={actual}
        setPage={setPage}
        perPage={perPage}
        totalCount={rows.length}
        labels={{
          navigation: "Halaman data",
          previousPage: "Sebelumnya",
          nextPage: "Berikutnya",
          firstPage: "Halaman pertama",
          lastPage: "Halaman terakhir",
        }}
      >
        <Pagination.Info>
          {() =>
            `${(actual - 1) * perPage + 1}–${Math.min(actual * perPage, rows.length)} dari ${rows.length} data`
          }
        </Pagination.Info>
        <Pagination.Controls controls="simple" />
      </Pagination>
    </div>
  );
}
