import React from 'react';
import Modal from './Modal';
import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

const NotificationModal = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    confirmText = 'Aceptar',
    onConfirm
}) => {

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="text-emerald-400" size={32} />;
            case 'warning':
                return <AlertTriangle className="text-amber-400" size={32} />;
            case 'error':
                return <XCircle className="text-red-400" size={32} />;
            default:
                return <Info className="text-primary" size={32} />;
        }
    };

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        } else {
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={null} // Custom header layout
            showCloseButton={false}
        >
            <div className="flex flex-col items-center text-center">
                <div className="mb-4 p-3 bg-primary/10 rounded-full border border-primary/20">
                    {getIcon()}
                </div>

                {title && (
                    <h3 className="text-xl font-bold text-white mb-2">
                        {title}
                    </h3>
                )}

                <p className="text-slate-400 mb-6">
                    {message}
                </p>

                <button
                    onClick={handleConfirm}
                    className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-medium transition-all shadow-lg shadow-primary/20"
                >
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
};

export default NotificationModal;
