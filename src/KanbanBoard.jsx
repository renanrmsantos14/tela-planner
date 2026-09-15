import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Plus } from "lucide-react";

const DRAG_REORDER_DURATION = 220;
const DRAG_REORDER_EASING = "cubic-bezier(.77, 0, .175, 1)";

function translateBetween(previous, next) {
  return `translate(${previous.left - next.left}px, ${previous.top - next.top}px)`;
}

const KanbanBoard = memo(function KanbanBoard({
  items,
  columns,
  itemsByColumn,
  getItemId = (item) => item.id,
  getSourceColumnId,
  getDropIndex = (grouped, columnId) => (grouped[columnId] || []).length,
  canMove = () => true,
  canCreate = () => true,
  onMove,
  onCreate,
  renderCard,
  renderColumnIcon,
  itemLabel = "item",
  itemLabelPlural = "itens",
  transferType = "text/kanban-id",
}) {
  const [dragState, setDragState] = useState(null);
  const [dropExit, setDropExit] = useState(null);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const boardRef = useRef(null);
  const cardRectsRef = useRef(new Map());
  const animateLayoutRef = useRef(false);
  const layoutAnimationsRef = useRef(new Map());
  const pendingTransferRef = useRef(null);
  const overflowFrameRef = useRef(null);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return undefined;
    const updateOverflow = () => {
      overflowFrameRef.current = null;
      const nextValue = board.scrollLeft + board.clientWidth < board.scrollWidth - 1;
      setHasHorizontalOverflow((current) => current === nextValue ? current : nextValue);
    };
    const scheduleOverflowUpdate = () => {
      if (overflowFrameRef.current !== null) return;
      overflowFrameRef.current = requestAnimationFrame(updateOverflow);
    };
    scheduleOverflowUpdate();
    board.addEventListener("scroll", scheduleOverflowUpdate, { passive: true });
    const observer = new ResizeObserver(scheduleOverflowUpdate);
    observer.observe(board);
    return () => {
      board.removeEventListener("scroll", scheduleOverflowUpdate);
      observer.disconnect();
      if (overflowFrameRef.current !== null) cancelAnimationFrame(overflowFrameRef.current);
      overflowFrameRef.current = null;
    };
  }, [columns.length]);

  useLayoutEffect(() => {
    const cards = [
      ...(boardRef.current?.querySelectorAll(".task-card[data-kanban-id]") || []),
    ];
    layoutAnimationsRef.current.forEach((animation) => animation.cancel());
    layoutAnimationsRef.current.clear();
    const nextRects = new Map(
      cards.map((card) => [card.dataset.kanbanId, card.getBoundingClientRect()]),
    );
    const motionDuration = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches
      ? 1
      : undefined;
    const pendingTransfer = pendingTransferRef.current;
    if (pendingTransfer) {
      const movedCard = cards.find(
        (card) => card.dataset.kanbanId === pendingTransfer.id,
      );
      const movedNext = movedCard && nextRects.get(pendingTransfer.id);
      const movedColumnId = movedCard?.closest(".board-column")?.dataset.columnId;
      if (
        movedCard &&
        movedNext &&
        pendingTransfer.slotRect &&
        movedColumnId === pendingTransfer.columnId
      ) {
        cards.forEach((card) => {
          const previous = card.dataset.kanbanId === pendingTransfer.id
            ? pendingTransfer.slotRect
            : cardRectsRef.current.get(card.dataset.kanbanId);
          const next = nextRects.get(card.dataset.kanbanId);
          if (!previous || !next || typeof card.animate !== "function") return;
          if (
            Math.abs(previous.top - next.top) < 1 &&
            Math.abs(previous.left - next.left) < 1
          ) return;
          layoutAnimationsRef.current.set(
            card.dataset.kanbanId,
            card.animate(
              [
                { transform: translateBetween(previous, next) },
                { transform: "translate(0, 0)" },
              ],
              {
                duration: motionDuration ?? DRAG_REORDER_DURATION,
                easing: DRAG_REORDER_EASING,
                fill: "both",
                composite: "replace",
              },
            ),
          );
        });
        pendingTransferRef.current = null;
        animateLayoutRef.current = false;
      } else if (!movedCard || !movedNext || movedColumnId === pendingTransfer.columnId) {
        pendingTransferRef.current = null;
      } else {
        return;
      }
    } else if (animateLayoutRef.current) {
      cards.forEach((card) => {
        const previous = cardRectsRef.current.get(card.dataset.kanbanId);
        const next = nextRects.get(card.dataset.kanbanId);
        if (
          !previous ||
          !next ||
          typeof card.animate !== "function" ||
          (Math.abs(previous.top - next.top) < 1 && Math.abs(previous.left - next.left) < 1)
        ) return;
        layoutAnimationsRef.current.set(
          card.dataset.kanbanId,
          card.animate(
            [
              { transform: translateBetween(previous, next) },
              { transform: "translate(0, 0)" },
            ],
            {
              duration: motionDuration ?? DRAG_REORDER_DURATION,
              easing: DRAG_REORDER_EASING,
              fill: "both",
              composite: "replace",
            },
          ),
        );
      });
      animateLayoutRef.current = false;
    }
    cardRectsRef.current = nextRects;
  }, [dragState?.columnId, dragState?.insertAt, dropExit, items]);

  useEffect(() => {
    if (!dropExit) return undefined;
    const timer = window.setTimeout(() => {
      animateLayoutRef.current = true;
      setDropExit(null);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [dropExit]);

  const handleDragStart = useCallback((itemId, event) => {
    const item = items.find((candidate) => getItemId(candidate) === itemId);
    const sourceColumnId = getSourceColumnId(item);
    setDropExit(null);
    setDragState({
      id: itemId,
      sourceColumnId,
      columnId: sourceColumnId,
      insertAt: 0,
      height: event.currentTarget.getBoundingClientRect().height,
    });
  }, [getItemId, getSourceColumnId, items]);

  const handleDragOver = useCallback((columnId, event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const draggedId = dragState?.id || event.dataTransfer.getData(transferType);
    const draggedItem = items.find((item) => getItemId(item) === draggedId);
    const insertAt = getDropIndex(itemsByColumn, columnId, draggedItem);
    setDragState((current) => {
      if (current && current.columnId === columnId && current.insertAt === insertAt) return current;
      animateLayoutRef.current = true;
      return { ...(current || {}), id: draggedId, columnId, insertAt };
    });
  }, [dragState?.id, getDropIndex, getItemId, items, itemsByColumn, transferType]);

  const getExitMetrics = useCallback(() => {
    const slot = boardRef.current?.querySelector(".card-drop-placeholder");
    const body = slot?.closest(".column-body");
    if (!slot || !body) return null;
    const slotRect = slot.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    return {
      top: slotRect.top,
      left: slotRect.left,
      localTop: slotRect.top - bodyRect.top,
      localLeft: slotRect.left - bodyRect.left,
      width: slotRect.width,
    };
  }, []);

  const handleDrop = useCallback((columnId, event) => {
    event.preventDefault();
    const id = dragState?.id || event.dataTransfer.getData(transferType);
    const item = items.find((candidate) => getItemId(candidate) === id);
    const shouldAttemptMove = Boolean(id && item && canMove(item) && dragState?.sourceColumnId !== columnId);
    const slotRect = getExitMetrics();
    if (shouldAttemptMove && dragState) {
      pendingTransferRef.current = { id, columnId, slotRect, insertAt: dragState.insertAt };
      setDropExit(null);
    } else if (dragState) {
      setDropExit({ ...dragState, isMove: false, slotRect });
    }
    setDragState(null);
    if (shouldAttemptMove) {
      const column = columns.find((candidate) => candidate.id === columnId);
      Promise.resolve(onMove(id, column)).then((success) => {
        if (success === false) pendingTransferRef.current = null;
      });
    }
  }, [canMove, columns, dragState, getExitMetrics, getItemId, items, onMove, transferType]);

  const clearDrag = useCallback(() => {
    if (dragState && !pendingTransferRef.current) {
      setDropExit({ ...dragState, isMove: false, slotRect: getExitMetrics() });
    }
    setDragState((current) => {
      if (!current) return current;
      animateLayoutRef.current = true;
      return null;
    });
  }, [dragState, getExitMetrics]);

  return (
    <div className={`board-scroll-shell${hasHorizontalOverflow ? " has-horizontal-overflow" : ""}`}>
      <div
        className="board-grid"
        ref={boardRef}
        style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(240px, 1fr))` }}
      >
        {columns.map((column) => {
          const columnItems = itemsByColumn[column.id] || [];
          const visibleDropState = dragState || dropExit;
          const isExiting = !dragState && Boolean(dropExit);
          const hasExitMetrics = isExiting && visibleDropState?.slotRect;
          const showDropSlot = Boolean(
            visibleDropState &&
            (!visibleDropState.isMove || dragState) &&
            visibleDropState.sourceColumnId !== column.id &&
            visibleDropState.columnId === column.id,
          );
          const dropSlot = showDropSlot ? (
            <div
              className={`drop-placeholder card-drop-placeholder ${hasExitMetrics ? "is-exiting" : ""}`}
              style={{
                "--drop-slot-height": `${Math.max(76, visibleDropState.height || 96)}px`,
                ...(hasExitMetrics ? {
                  "--drop-slot-top": `${visibleDropState.slotRect.localTop}px`,
                  "--drop-slot-left": `${visibleDropState.slotRect.localLeft}px`,
                  "--drop-slot-width": `${visibleDropState.slotRect.width}px`,
                } : {}),
              }}
              aria-label={`Espaço para soltar em ${column.label}`}
            >
              <Plus size={17} aria-hidden="true" />
              <span>Solte aqui</span>
            </div>
          ) : null;
          return (
            <section
              className={`board-column ${showDropSlot ? "is-drop-target" : ""}`}
              data-column-id={column.id}
              key={column.id}
              onDragOver={(event) => handleDragOver(column.id, event)}
              onDrop={(event) => handleDrop(column.id, event)}
              onDragEnd={clearDrag}
            >
              <div className="column-header">
                <div>
                  {renderColumnIcon?.(column)}
                  <h2>{column.label}</h2>
                  <span className="column-count">{columnItems.length}</span>
                </div>
                {onCreate && (
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => onCreate(column)}
                    aria-label={`Criar ${itemLabel} em ${column.label}`}
                    disabled={!canCreate(column)}
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
              <div className="column-body">
                {columnItems.map((item, index) => {
                  const itemId = getItemId(item);
                  return (
                    <React.Fragment key={itemId}>
                      {showDropSlot && visibleDropState.insertAt === index && dropSlot}
                      {renderCard(item, {
                        isDragging: dragState?.id === itemId,
                        onDragStart: (event) => handleDragStart(itemId, event),
                        onDragEnd: clearDrag,
                      })}
                    </React.Fragment>
                  );
                })}
                {showDropSlot && visibleDropState.insertAt >= columnItems.length && dropSlot}
                {!columnItems.length && !showDropSlot && (
                  <div className="drop-placeholder">
                    <Plus size={17} />
                    <span>Arraste {itemLabelPlural} para cá</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
});

export default KanbanBoard;
