export function RuleGuide() {
  return (
    <aside className="rule-guide" aria-label="게임 규칙 설명">
      <div className="rule-guide__header">
        <small>RULE GUIDE</small>
        <h3>HOW TO WIN</h3>
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
          <span>게임당 1번, 상대 선택 일부를 내 돌로 전환할 수 있습니다.</span>
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
          <span>가장자리 돌의 양옆이 모두 내 돌이 아니면 제거됩니다. 검은 코너도 적으로 취급합니다.</span>
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
