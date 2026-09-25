import React, { useState, useEffect } from 'react';
import AlternativeMapRouteModal, { AlternativeMapRouteModalProps } from './AlternativeMapRouteModal';
import { AlternativeMapEventDetail } from '@/lib/mapUtils';

export default function GlobalAlternativeMapModal() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    data?: AlternativeMapEventDetail;
  }>({
    isOpen: false,
  });

  useEffect(() => {
    const handleOpenMap = (e: Event) => {
      const customEvent = e as CustomEvent<AlternativeMapEventDetail>;
      if (customEvent.detail) {
        setModalState({
          isOpen: true,
          data: customEvent.detail,
        });
      }
    };

    window.addEventListener('sareeone:open-alternative-map', handleOpenMap);
    return () => {
      window.removeEventListener('sareeone:open-alternative-map', handleOpenMap);
    };
  }, []);

  if (!modalState.isOpen || !modalState.data) {
    return null;
  }

  return (
    <AlternativeMapRouteModal
      isOpen={modalState.isOpen}
      onClose={() => setModalState({ isOpen: false })}
      destinationLat={modalState.data.lat}
      destinationLng={modalState.data.lng}
      destinationAddress={modalState.data.address}
      destinationName={modalState.data.name}
      destinationType={modalState.data.type || 'customer'}
      destinationPhone={modalState.data.phone}
      orderNumber={modalState.data.orderNumber}
    />
  );
}
