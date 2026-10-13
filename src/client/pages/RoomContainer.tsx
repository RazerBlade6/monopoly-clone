import { useRoomConnection } from '../net';
import { navigate } from '../router';
import { getMap } from '../mapSource';
import { Lobby } from './Lobby';
import { Game } from './Game';

export function RoomContainer({ code }: { code: string }) {
  const conn = useRoomConnection(code);

  if (conn.state) {
    const map = getMap(conn.state.mapId);
    if (conn.playerId) {
      return (
        <Game
          map={map}
          state={conn.state}
          myPlayerId={conn.playerId}
          events={conn.events}
          onAction={conn.sendAction}
          code={code}
          error={conn.error}
          onClearError={conn.clearError}
        />
      );
    }
  }

  return (
    <Lobby
      code={code}
      status={conn.status}
      room={conn.room}
      players={conn.players}
      myPlayerId={conn.playerId}
      error={conn.error}
      onJoin={conn.join}
      onLeave={() => { conn.leave(); navigate('/'); }}
      onAddDummy={conn.addDummy}
      onRemovePlayer={conn.removePlayer}
      onUpdateSettings={conn.updateSettings}
      onStart={conn.startGame}
    />
  );
}
