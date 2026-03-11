import { Children, Fragment, cloneElement, isValidElement, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

type DataTableAlign = "left" | "center" | "right";

const alignClassName: Record<DataTableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const alignJustifyClassName: Record<DataTableAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const TABLE_CELL_PADDING_Y = "py-2.5";
export type DataTableSortDirection = "asc" | "desc";
export type DataTableSortState = { key: string; direction: DataTableSortDirection } | null;

export interface DataTableColumn<T = unknown> {
  key: string;
  title: ReactNode;
  align?: DataTableAlign;
  width?: number | string;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  sortValue?: (row: T, index: number) => unknown;
  sortComparator?: (a: T, b: T) => number;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  renderRow: (row: T, index: number) => ReactNode;
  onRowClick?: (row: T, index: number) => void;
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
  defaultSort?: { key: string; direction?: DataTableSortDirection } | null;
  sortState?: DataTableSortState;
  onSortStateChange?: (next: DataTableSortState) => void;
}

function flattenRowNodes(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).flatMap((node) => {
    if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
      return flattenRowNodes(node.props.children);
    }
    return [node];
  });
}

function normalizeRowCells<T>(nodes: ReactNode, columns: DataTableColumn<T>[]) {
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

function normalizeSortValue(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numericLike = Number(trimmed);
    if (!Number.isNaN(numericLike) && /^-?\d+([.,]\d+)?$/.test(trimmed)) {
      return numericLike;
    }

    return trimmed.toLocaleLowerCase("pt-BR");
  }

  return String(value).toLocaleLowerCase("pt-BR");
}

function compareSortValues(a: unknown, b: unknown) {
  const normalizedA = normalizeSortValue(a);
  const normalizedB = normalizeSortValue(b);

  if (normalizedA === null && normalizedB === null) return 0;
  if (normalizedA === null) return 1;
  if (normalizedB === null) return -1;

  if (typeof normalizedA === "number" && typeof normalizedB === "number") {
    return normalizedA - normalizedB;
  }

  if (typeof normalizedA === "boolean" && typeof normalizedB === "boolean") {
    return Number(normalizedA) - Number(normalizedB);
  }

  return String(normalizedA).localeCompare(String(normalizedB), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortDirectionClassName(active: boolean) {
  return active ? "text-primary" : "text-muted-foreground/55 hover:text-muted-foreground";
}

function isDefaultNonSortableKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return normalized === "acoes" || normalized === "status" || normalized === "ativo";
}

export function sortDataTableRows<T>(
  rows: T[],
  columns: DataTableColumn<T>[],
  sortState: DataTableSortState,
) {
  if (!sortState) {
    return rows;
  }

  const column = columns.find((item) => item.key === sortState.key);
  if (!column) {
    return rows;
  }

  const directionFactor = sortState.direction === "asc" ? 1 : -1;
  const wrapped = rows.map((row, index) => ({ row, index }));

  wrapped.sort((a, b) => {
    const baseResult = column.sortComparator
      ? column.sortComparator(a.row, b.row)
      : compareSortValues(
          column.sortValue ? column.sortValue(a.row, a.index) : (a.row as Record<string, unknown>)[column.key],
          column.sortValue ? column.sortValue(b.row, b.index) : (b.row as Record<string, unknown>)[column.key],
        );

    if (baseResult !== 0) {
      return baseResult * directionFactor;
    }

    return a.index - b.index;
  });

  return wrapped.map((item) => item.row);
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  renderRow,
  onRowClick,
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
  defaultSort = null,
  sortState,
  onSortStateChange,
}: DataTableProps<T>) {
  const [internalSortState, setInternalSortState] = useState<DataTableSortState>(
    defaultSort
      ? {
          key: defaultSort.key,
          direction: defaultSort.direction ?? "asc",
        }
      : null,
  );
  const currentSortState = sortState !== undefined ? sortState : internalSortState;

  const effectiveSortState = useMemo<DataTableSortState>(() => {
    if (!currentSortState) {
      return null;
    }
    if (columns.some((column) => column.key === currentSortState.key)) {
      return currentSortState;
    }
    return null;
  }, [columns, currentSortState]);

  const hasWidthConfig = columns.some((column) => Boolean(column.width));
  const shouldUseEqualColumns = equalColumns && !hasWidthConfig;
  const equalColWidth = columns.length > 0 ? `${(100 / columns.length).toFixed(4)}%` : undefined;
  const sortedRows = useMemo(() => {
    return sortDataTableRows(rows, columns, effectiveSortState);
  }, [columns, rows, effectiveSortState]);

  function updateSortState(next: DataTableSortState) {
    if (sortState === undefined) {
      setInternalSortState(next);
    }
    onSortStateChange?.(next);
  }

  function shouldIgnoreRowClick(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button,a,input,select,textarea,[role='button'],[data-row-ignore-click='true']",
      ),
    );
  }

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
                <div className={cn("flex items-center gap-1", alignJustifyClassName[column.align ?? "left"])}>
                  <span>{column.title}</span>
                  {(column.sortable ?? !isDefaultNonSortableKey(column.key)) ? (
                    <span className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label={`Ordenar ${String(column.key)} crescente`}
                        className={cn(
                          "h-5 w-5 rounded-sm leading-none transition-colors",
                          sortDirectionClassName(
                            effectiveSortState?.key === column.key && effectiveSortState?.direction === "asc",
                          ),
                        )}
                        onClick={() => updateSortState({ key: column.key, direction: "asc" })}
                      >
                        <ChevronUp className="mx-auto h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Ordenar ${String(column.key)} decrescente`}
                        className={cn(
                          "h-5 w-5 rounded-sm leading-none transition-colors",
                          sortDirectionClassName(
                            effectiveSortState?.key === column.key && effectiveSortState?.direction === "desc",
                          ),
                        )}
                        onClick={() => updateSortState({ key: column.key, direction: "desc" })}
                      >
                        <ChevronDown className="mx-auto h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={cn("py-8", emptyCellClassName)}>
                {loading ? (
                  <div className="space-y-2 px-4 animate-in fade-in-0">
                    <p className="text-center text-xs text-muted-foreground">{loadingMessage}</p>
                    <div className="h-2.5 rounded-full bg-muted/70 animate-pulse-slow" />
                    <div className="h-2.5 rounded-full bg-muted/55 animate-pulse-slow" />
                    <div className="h-2.5 rounded-full bg-muted/45 animate-pulse-slow" />
                  </div>
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
            sortedRows.map((row, index) => (
              <tr
                key={getRowKey(row)}
                className={cn(
                  "border-b border-border/65 transition-colors odd:bg-muted/15 hover:bg-accent/45",
                  onRowClick ? "cursor-pointer" : null,
                  typeof rowClassName === "function" ? rowClassName(row, index) : rowClassName,
                )}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={(event) => {
                  if (!onRowClick || shouldIgnoreRowClick(event.target)) return;
                  onRowClick(row, index);
                }}
                onKeyDown={(event) => {
                  if (!onRowClick) return;
                  if (event.key !== "Enter" && event.key !== " ") return;
                  if (shouldIgnoreRowClick(event.target)) return;
                  event.preventDefault();
                  onRowClick(row, index);
                }}
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
