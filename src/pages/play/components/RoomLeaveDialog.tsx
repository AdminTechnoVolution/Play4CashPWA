import React from 'react';
import { IonAlert } from '@ionic/react';
import { useT } from '../../../i18n/translations';

interface RoomLeaveDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const RoomLeaveDialog: React.FC<RoomLeaveDialogProps> = ({ isOpen, onConfirm, onCancel }) => {
  const t = useT();
  return (
    <IonAlert
      isOpen={isOpen}
      header={t('APP.GAME.LEAVE_TITLE')}
      message={t('APP.GAME.LEAVE_MSG')}
      buttons={[
        {
          text: t('APP.GAME.LEAVE_CANCEL'),
          role: 'cancel',
          handler: onCancel,
        },
        {
          text: t('APP.GAME.LEAVE_CONFIRM'),
          role: 'destructive',
          cssClass: 'alert-button-danger',
          handler: onConfirm,
        },
      ]}
      onDidDismiss={onCancel}
    />
  );
};

export default RoomLeaveDialog;
