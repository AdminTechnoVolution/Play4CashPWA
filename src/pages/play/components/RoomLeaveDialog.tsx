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
      header={t('bs_leave_confirm_title')}
      message={t('bs_leave_confirm_message')}
      buttons={[
        {
          text: t('bs_leave_confirm_stay'),
          role: 'cancel',
          handler: onCancel,
        },
        {
          text: t('bs_leave_confirm_leave'),
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
