import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IonPage, IonContent } from '@ionic/react';
import { apiRepository } from '../../data/network/ApiRepository';
import RoomLeaveDialog from './components/RoomLeaveDialog';
import BattleshipPage from './battleship/BattleshipPage';
import ChessPage from './chess/ChessPage';
import DominoPage from './domino/DominoPage';
import HalmaPage from './halma/HalmaPage';

export default function PlayPage() {
  const {
    gameSocketCode = '',
    roomId = '',
    betAmount = '0',
    roomName = '',
    opponentName = '',
    isSpectator: isSpectatorParam = 'false',
  } = useParams<{
    gameSocketCode: string;
    roomId: string;
    betAmount: string;
    roomName: string;
    opponentName: string;
    hasOpponent: string;
    isSpectator: string;
  }>();

  const navigate = useNavigate();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const isSpectator = isSpectatorParam === 'true';
  const bet = parseFloat(betAmount);

  const handleLeaveRequest = () => setShowLeaveDialog(true);

  const handleLeaveConfirm = async () => {
    try { await apiRepository.leaveRoom(roomId); } catch (_) { /* ignore */ }
    setShowLeaveDialog(false);
    navigate(-1);
  };

  const gameProps = {
    roomId,
    betAmount: bet,
    roomName: decodeURIComponent(roomName),
    opponentName: decodeURIComponent(opponentName),
    isSpectator,
    onLeaveRequest: handleLeaveRequest,
  };

  const renderGame = () => {
    switch (gameSocketCode) {
      case 'chess':  return <ChessPage {...gameProps} />;
      case 'halma':  return <HalmaPage {...gameProps} />;
      case 'domino': return <DominoPage {...gameProps} />;
      default:       return <BattleshipPage {...gameProps} />;
    }
  };

  return (
    <>
      {renderGame()}
      <RoomLeaveDialog
        isOpen={showLeaveDialog}
        onConfirm={handleLeaveConfirm}
        onCancel={() => setShowLeaveDialog(false)}
      />
    </>
  );
}
