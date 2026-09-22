import type { PublicPlayer } from '../types';

interface PlayerLegendProps {
  players: PublicPlayer[];
  myId: string;
  hostId: string;
}

export function PlayerLegend({ players, myId, hostId }: PlayerLegendProps) {
  return (
    <aside className="player-legend" aria-label="플레이어 돌 색상 및 연결 상태">
      <div className="player-legend__header">
        <small>PLAYER SIGNAL</small>
        <strong>STONE COLORS</strong>
      </div>
      <div className="player-legend__list">
        {players.map((player) => {
          const isMe = player.id === myId;
          const isHost = player.id === hostId;
          return (
            <div className={`player-legend__item ${isMe ? 'player-legend__item--me' : ''}`} key={player.id}>
              <span className={`player-legend__stone player-dot--${player.colorIndex}`} />
              <div>
                <strong>{player.nickname}</strong>
                <small>
                  {isMe ? 'MY STONE · ' : ''}
                  {isHost ? 'HOST · ' : ''}
                  {player.connected ? 'LINKED' : 'SIGNAL LOST'}
                </small>
              </div>
              <i className={`connection-light ${player.connected ? 'connection-light--on' : 'connection-light--off'}`} />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
