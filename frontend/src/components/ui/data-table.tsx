import { Children, Fragment, cloneElement, isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

type DataTableAlign = "left" | "center" | "right";

const alignClassName: Record<DataTableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const TABLE_CELL_PADDING_Y = "py-2.5";

export interface DataTableColumn {
  key: string;
  title: ReactNode;
  align?: DataTableAlign;
  width?: number | string;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  renderRow: (row: T, index: number) => ReactNode;
  emptyMessage: string;
  loading?: boolean;
  loadingMessage?: string;
  minWidthClassName?: string;
  containerClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  fixedLayout?: boolean;
  equalColumns?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  emptyCellClassName?: string;
}

function flattenRowNodes(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).flatMap((node) => {
    if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
      return flattenRowNodes(node.props.children);
    }
    return [node];
  });
}

function normalizeRowCells(nodes: ReactNode, columns: DataTableColumn[]) {
  return flattenRowNodes(nodes).map((node, index) => {
    if (!isValidElement<{ className?: string }>(node) || node.type !== "td") {
      return node;
    }

    const column = columns[index];
    return cloneElement(node, {
      className: cn(
        node.props.className,
        column?.className,
        TABLE_CELL_PADDING_Y,
        "align-middle",
        alignClassName[column?.align ?? "left"],
      ),
    });
  });
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  renderRow,
  emptyMessage,
  loading = false,
  loadingMessage = "Carregando...",
  minWidthClassName = "min-w-[720px]",
  containerClassName,
  rowClassName,
  fixedLayout = true,
  equalColumns = true,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyCellClassName,
}: DataTableProps<T>) {
  const hasWidthConfig = columns.some((column) => Boolean(column.width));
  const shouldUseEqualColumns = equalColumns && !hasWidthConfig;
  const equalColWidth = columns.length > 0 ? `${(100 / columns.length).toFixed(4)}%` : undefined;

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border/70 bg-surface-2/80", containerClassName)}>
      <table className={cn("ui-data-table w-full text-xs", fixedLayout ? "table-fixed" : "table-auto", minWidthClassName)}>
        {fixedLayout && (shouldUseEqualColumns || hasWidthConfig) ? (
          <colgroup>
            {columns.map((column) => (
              <col
                key={`col-${column.key}`}
                style={shouldUseEqualColumns
                  ? { width: equalColWidth }
                  : column.width !== undefined
                    ? { width: typeof column.width === "number" ? `${column.width}px` : column.width }
                    : undefined}
              />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr className="border-b border-border/70">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  TABLE_CELL_PADDING_Y,
                  "align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                  alignClassName[column.align ?? "left"],
                  column.headerClassName,
                )}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={cn("py-8", emptyCellClassName)}>
                {loading ? (
                  <p className="text-center text-xs text-muted-foreground">{loadingMessage}</p>
                ) : (
                  <EmptyState
                    compact
                    title={emptyTitle ?? emptyMessage}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={getRowKey(row)}
                className={cn(
                  "border-b border-border/65 transition-colors odd:bg-muted/15 hover:bg-accent/45",
                  typeof rowClassName === "function" ? rowClassName(row, index) : rowClassName,
                )}
              >
                {normalizeRowCells(renderRow(row, index), columns)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
