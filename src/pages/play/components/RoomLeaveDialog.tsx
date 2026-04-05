import React from 'react';
import { IonAlert } from '@ionic/react';

interface RoomLeaveDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const RoomLeaveDialog: React.FC<RoomLeaveDialogProps> = ({ isOpen, onConfirm, onCancel }) => {
  return (
    <IonAlert
      isOpen={isOpen}
      header="Leave Match"
      message="Are you sure you want to leave? You will forfeit the match."
      buttons={[
        {
          text: 'Stay',
          role: 'cancel',
          handler: onCancel,
        },
        {
          text: 'Leave',
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
