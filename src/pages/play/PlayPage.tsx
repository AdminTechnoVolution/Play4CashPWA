import { useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { IonPage, IonContent, IonText } from '@ionic/react';
import { apiRepository } from '../../data/network/ApiRepository';
import RoomLeaveDialog from './components/RoomLeaveDialog';
import BattleshipPage from './battleship/BattleshipPage';
import ChessPage from './chess/ChessPage';
import DominoPage from './domino/DominoPage';
import HalmaPage from './halma/HalmaPage';

interface PlayParams {
  gameSocketCode: string;
  roomId: string;
  betAmount: string;
  roomName: string;
  opponentName: string;
  hasOpponent: string;
  isSpectator: string;
}

export default function PlayPage() {
  const params = useParams<PlayParams>();
  const history = useHistory();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const isSpectator = params.isSpectator === 'true';
  const betAmount = parseFloat(params.betAmount);

  const handleLeaveRequest = () => setShowLeaveDialog(true);

  const handleLeaveConfirm = async () => {
    try {
      await apiRepository.leaveRoom(params.roomId);
    } catch (_) { /* ignore */ }
    setShowLeaveDialog(false);
    history.goBack();
  };

  const gameProps = {
    roomId: params.roomId,
    betAmount,
    roomName: params.roomName,
    opponentName: params.opponentName,
    isSpectator,
    onLeaveRequest: handleLeaveRequest,
  };

  const renderGame = () => {
    switch (params.gameSocketCode) {
      case 'naval-battle':
        return <BattleshipPage {...gameProps} />;
      case 'chess':
        return <ChessPage {...gameProps} />;
      case 'domino':
        return <DominoPage {...gameProps} />;
      case 'halma':
        return <HalmaPage {...gameProps} />;
      default:
        return (
          <IonPage>
            <IonContent className="ion-padding">
              <IonText color="danger">
                <p>Unknown game: {params.gameSocketCode}</p>
              </IonText>
            </IonContent>
          </IonPage>
        );
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
