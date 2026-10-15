"use client";
import { Button, Empty, Pagination, Table, Text } from "@cloudflare/kumo";
import { Modal } from "./shared";
import { ReactNode, useId, useState } from "react";
export type DataColumn<T> = {
  title: string;
  render: (row: T) => ReactNode;
  mobile?: "title" | "status" | "primary" | "details" | "action";
};
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  empty,
  perPage = 15,
  mobile = "records",
}: {
  rows: T[];
  columns: DataColumn<T>[];
  empty?: string;
  perPage?: number;
  mobile?: "records" | "table";
}) {
  const id = useId();
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<T | null>(null);
  const actual = Math.min(page, Math.max(1, Math.ceil(rows.length / perPage)));
  const pageRows = rows.slice((actual - 1) * perPage, actual * perPage);
  if (!rows.length)
    return (
      <Empty
        className="empty"
        title="Belum ada data"
        description={empty ?? "Tambahkan data baru."}
      />
    );
  const title = columns.findIndex((c) => c.mobile === "title");
  const titleIndex = title < 0 ? 0 : title;
  const statusIndex = columns.findIndex(
    (c, index) =>
      index !== titleIndex &&
      (c.mobile === "status" || /^(status|kesiapan)$/i.test(c.title)),
  );
  const actionIndices = columns
    .map((c, index) =>
      !c.title || /^(aksi|tindakan)$/i.test(c.title) || c.mobile === "action"
        ? index
        : -1,
    )
    .filter((index) => index >= 0 && index !== titleIndex);
  const remaining = columns
    .map((c, index) => ({ ...c, index }))
    .filter(
      (c) =>
        c.index !== titleIndex &&
        c.index !== statusIndex &&
        !actionIndices.includes(c.index),
    );
  const secondary = remaining.find((c) =>
    /^(customer|pelanggan)$/i.test(c.title),
  );
  const ranked = remaining
    .filter((c) => c.index !== secondary?.index)
    .sort(
      (a, b) =>
        Number(
          b.mobile === "primary" ||
            /saldo|nominal|jumlah|tenggat|jatuh tempo|rute|credit/i.test(
              b.title,
            ),
        ) -
        Number(
          a.mobile === "primary" ||
            /saldo|nominal|jumlah|tenggat|jatuh tempo|rute|credit/i.test(
              a.title,
            ),
        ),
    );
  const primary = ranked.filter((c) => c.mobile !== "details").slice(0, 1);
  const facts = (row: T, fields: typeof remaining) => (
    <dl className="mobile-record-facts">
      {fields.map((c) => (
        <div key={c.index}>
          <Text as="dt" variant="secondary">
            {c.title}
          </Text>
          <dd>{c.render(row)}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <div
      className={`data-collection ${mobile === "table" ? "comparison-collection" : "record-collection"}`}
    >
      <div className="table-scroll desktop-record-table">
        <Table
          className="responsive-table"
          style={{ minWidth: Math.max(360, columns.length * 140) }}
        >
          <Table.Header>
            <Table.Row>
              {columns.map((c, index) => (
                <Table.Head key={index}>{c.title || "Aksi"}</Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {pageRows.map((row) => (
              <Table.Row key={row.id}>
                {columns.map((c, index) => (
                  <Table.Cell
                    key={index}
                    className={!c.title ? "action-cell" : undefined}
                  >
                    <div className="cell-content">{c.render(row)}</div>
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      {mobile === "records" && (
        <div className="mobile-record-list">
          {pageRows.map((row) => (
            <article
              key={row.id}
              className="mobile-record"
              aria-labelledby={`${id}-${row.id}`}
            >
              <header className="mobile-record-heading">
                <div id={`${id}-${row.id}`} className="mobile-record-identity">
                  {columns[titleIndex].render(row)}
                  {secondary && (
                    <div className="mobile-record-secondary">
                      {secondary.render(row)}
                    </div>
                  )}
                </div>
                {(statusIndex >= 0 || actionIndices.length > 0) && (
                  <div className="mobile-record-trailing">
                    {statusIndex >= 0 && (
                      <div className="mobile-record-status">
                        {columns[statusIndex].render(row)}
                      </div>
                    )}
                    {actionIndices.map((index) => (
                      <div className="mobile-record-actions" key={index}>
                        {columns[index].render(row)}
                      </div>
                    ))}
                  </div>
                )}
              </header>
              {!!primary.length && facts(row, primary)}
              <Button
                variant="ghost"
                className="mobile-record-more"
                onClick={() => setDetail(row)}
              >
                Selengkapnya
              </Button>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Rincian data"
      >
        {detail && (
          <div className="detail-body record-detail-body">
            {columns
              .filter((c) => c.title && c.mobile !== "action")
              .map((c, i) => (
                <section key={i}>
                  <Text variant="secondary">{c.title}</Text>
                  <div>{c.render(detail)}</div>
                </section>
              ))}
          </div>
        )}
      </Modal>
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
