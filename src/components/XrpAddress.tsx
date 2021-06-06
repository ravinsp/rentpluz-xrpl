import React from 'react';
import { IonText, IonModal, IonButton } from '@ionic/react';
import QRCode from 'qrcode.react';

class XrpAddress extends React.Component<any> {

    constructor(props: any) {
        super(props);
        this.state = {
            show: false
        }
        this.showQRCode = this.showQRCode.bind(this);
        this.hideQRCode = this.hideQRCode.bind(this);
    }

    showQRCode() {
        this.setState({ show: true });
    }

    hideQRCode() {
        this.setState({ show: false });
    }

    render() {
        const { title, addr } = this.props as any;
        const { show } = this.state as any;

        return (
            <div className="section">
                <div><IonText color="success">{title}</IonText></div>
                <div><a href="#" onClick={this.showQRCode}>{addr}</a></div>
                <IonModal isOpen={show} backdropDismiss={false} cssClass='my-custom-class'>
                    <div className="section">
                        {addr}
                    </div>
                    <div className="section">
                        <QRCode value={addr} size={256}></QRCode>
                    </div>
                    <IonButton onClick={this.hideQRCode}>Close</IonButton>
                </IonModal>

            </div>)
    }
}

export default XrpAddress;
