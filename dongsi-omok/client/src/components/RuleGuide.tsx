import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  originX: number;
  originY: number;
  width: number;
};

type GuideStyle = CSSProperties & {
  '--rule-guide-x': string;
  '--rule-guide-y': string;
};

export function RuleGuide() {
  const guideRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const panel = guideRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      originX: offset.x,
      originY: offset.y,
      width: rect.width,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const minLeft = 8;
    const minTop = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - drag.width - 8);
    const maxTop = Math.max(minTop, window.innerHeight - 48);
    const nextLeft = Math.min(maxLeft, Math.max(minLeft, drag.startLeft + dx));
    const nextTop = Math.min(maxTop, Math.max(minTop, drag.startTop + dy));

    setOffset({
      x: drag.originX + (nextLeft - drag.startLeft),
      y: drag.originY + (nextTop - drag.startTop),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const style: GuideStyle = {
    '--rule-guide-x': `${offset.x}px`,
    '--rule-guide-y': `${offset.y}px`,
  };

  return (
    <aside
      ref={guideRef}
      className={`rule-guide ${dragging ? 'rule-guide--dragging' : ''}`}
      aria-label="게임 규칙 설명"
      style={style}
    >
      <div
        className="rule-guide__header"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="rule-guide__header-row">
          <div>
            <small>RULE GUIDE</small>
            <h3>HOW TO WIN</h3>
          </div>
          <span className="rule-guide__drag-hint">DRAG TO MOVE</span>
        </div>
        <p>이미지로 핵심 규칙만 빠르게 확인하세요.</p>
      </div>

      <div className="rule-card">
        <div className="rule-card__diagram rule-card__diagram--opening">
          <span className="stone-dot stone-dot--a" />
          <span className="stone-dot stone-dot--a" />
          <span className="stone-dot stone-dot--a" />
        </div>
        <div className="rule-card__copy">
          <strong>OPENING</strong>
          <span>처음에는 순서대로 3개의 돌을 먼저 둡니다.</span>
        </div>
      </div>

      <div className="rule-card">
        <div className="rule-card__diagram rule-card__diagram--planning">
          <span className="ghost-dot ghost-dot--pick" />
          <span className="ghost-dot ghost-dot--pick" />
          <span className="ghost-dot ghost-dot--pick" />
          <span className="ghost-dot ghost-dot--collision">×</span>
        </div>
        <div className="rule-card__copy">
          <strong>ROUND</strong>
          <span>라운드마다 최대 3곳 선택. 같은 좌표는 충돌로 무효입니다.</span>
        </div>
      </div>

      <div className="rule-card">
        <div className="rule-card__diagram rule-card__diagram--takeover">
          <span className="stone-dot stone-dot--b" />
          <span className="rule-arrow">→</span>
          <span className="stone-dot stone-dot--a" />
          <span className="rule-badge">1x</span>
        </div>
        <div className="rule-card__copy">
          <strong>TAKEOVER</strong>
          <span>게임당 1번, 상대 선택 3돌 중 2돌을 내 돌로 전환 시킬 수 있습니다.</span>
        </div>
      </div>

      <div className="rule-card">
        <div className="rule-card__diagram rule-card__diagram--edge">
          <div className="edge-strip edge-strip--top">
            <span className="stone-dot stone-dot--a" />
            <span className="stone-dot stone-dot--a" />
          </div>
        </div>
        <div className="rule-card__copy">
          <strong>EDGE TERRITORY</strong>
          <span>처음 성공한 가장자리 변이 내 영역. 같은 변에 내 돌 2개가 살아 있어야 합니다.</span>
        </div>
      </div>

      <div className="rule-card">
        <div className="rule-card__diagram rule-card__diagram--capture">
          <span className="stone-dot stone-dot--b" />
          <span className="stone-dot stone-dot--a" />
          <span className="stone-dot stone-dot--c" />
        </div>
        <div className="rule-card__copy">
          <strong>EDGE CAPTURE</strong>
          <span>가장자리의 연속된 내 돌 묶음은 양끝이 상대 돌 또는 검은 돌에 막히면 묶음 전체가 제거됩니다.</span>
        </div>
      </div>

      <div className="rule-card rule-card--win">
        <div className="rule-card__diagram rule-card__diagram--win">
          <span className="win-pill">EDGE 2/2</span>
          <div className="five-line">
            <span className="stone-dot stone-dot--a" />
            <span className="stone-dot stone-dot--a" />
            <span className="stone-dot stone-dot--a" />
            <span className="stone-dot stone-dot--a" />
            <span className="stone-dot stone-dot--a" />
          </div>
        </div>
        <div className="rule-card__copy">
          <strong>WIN</strong>
          <span>영역 조건을 갖춘 뒤 새로운 5목을 만들어야 승리합니다. 먼저 만든 5목은 소급 승리되지 않습니다.</span>
        </div>
      </div>
    </aside>
  );
}
