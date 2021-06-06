import React from 'react';
import { IonText, IonPage, IonButton, IonModal, IonLoading } from '@ionic/react';
import XrpAddress from '../components/XrpAddress'
import BarcodeScannerComponent from "react-webcam-barcode-scanner";
import './Home.css';
import storage from '../services/storage-helper'
import nft from '../services/nft-helper'
import ripple from '../services/ripple-helper'

class Home extends React.Component {

    constructor(props: any) {
        super(props);

        this.state = {
            owner: props.owner,
            tenant: props.tenant,
            qrScanner: {
                show: false,
                title: null,
                qrcode: null
            },
            loading: {
                show: false,
                title: null
            }
        };

        this.registerOwner = this.registerOwner.bind(this);
        this.registerProperty = this.registerProperty.bind(this);
        this.rentProperty = this.rentProperty.bind(this);
        this.registerTenant = this.registerTenant.bind(this);
        this.takeProperty = this.takeProperty.bind(this);
        this.resetWallet = this.resetWallet.bind(this);
        this.scanQR = this.scanQR.bind(this);
        this.hideQRScanner = this.hideQRScanner.bind(this);
        this.reportQRCode = this.reportQRCode.bind(this);
        this.selectFile = this.selectFile.bind(this);
        this.onFileSelected = this.onFileSelected.bind(this);
        this.showLoading = this.showLoading.bind(this);
        this.hideLoading = this.hideLoading.bind(this);
    }

    async registerOwner() {

        await this.showLoading("Creating Owner XRP account.");
        const ownerAcc = await ripple.createAccount();
        await this.hideLoading();
        if (!ownerAcc)
            return;

        this.setState({
            owner: {
                account: {
                    addr: ownerAcc.addr
                }
            }
        }, () => storage.persist("owner", ownerAcc));
    }

    async registerProperty() {

        // Get property ownership proof file.
        const file: any = await this.selectFile();
        if (!file)
            return;
        if (file.size > 4 * 1024 * 1024) {
            alert("File has to be less than 4MB.");
            return;
        }

        await this.showLoading("Setting up Property account with Owner trust lines...");

        const propertyAcc = await ripple.createAccount();
        if (!propertyAcc) {
            await this.hideLoading();
            return;
        }

        const s: any = this.state;

        // Generate the NFT.
        const nftHex = await nft.generatePropertyOwnershipNft(s.owner.account.addr, propertyAcc.addr, file);

        // Create 2 trust lines back and forth between owner account and property account.
        const lines = [
            { fromAddr: s.owner.account.addr, toAddr: propertyAcc.addr, nftHex: nftHex, secret: storage.get("owner").seed },
            { fromAddr: propertyAcc.addr, toAddr: s.owner.account.addr, nftHex: nftHex, secret: propertyAcc.seed }
        ]
        const result = await ripple.createTrustLines(lines);
        this.hideLoading();
        if (!result)
            return;

        this.setState((s: any) => ({
            owner: {
                ...s.owner,
                property: {
                    account: {
                        addr: propertyAcc.addr
                    }
                }
            }
        }), () => storage.persist("property", propertyAcc));
    }

    async rentProperty() {

        // Get rental agreement file.
        const file: any = await this.selectFile();
        if (!file)
            return;
        if (file.size > 4 * 1024 * 1024) {
            alert("File has to be less than 4MB.");
            return;
        }

        // Get tenant's xrp address.
        const tenantXrpAddr: any = await this.scanQR("Scan the Tenant's XRP address");
        if (!tenantXrpAddr || tenantXrpAddr.length == 0)
            return;

        await this.showLoading("Creating Rental agreement trust lines");

        const s: any = this.state;

        // Generate the NFT.
        const nftHex = await nft.generateRentalAgreementNft(s.owner.property.account.addr, tenantXrpAddr, file);

        // Create a trust line from property account to tenant account.
        const lines = [{ fromAddr: s.owner.property.account.addr, toAddr: tenantXrpAddr, nftHex: nftHex, secret: storage.get("property").seed }]
        const result = await ripple.createTrustLines(lines);
        this.hideLoading();
        if (!result)
            return;

        this.setState((s: any) => ({
            owner: {
                ...s.owner,
                property: {
                    ...s.owner.property,
                    tenant: {
                        account: {
                            addr: tenantXrpAddr
                        }
                    }
                }
            }
        }), () => storage.persist("tenant", (this.state as any).owner.property.tenant.account));
    }

    async registerTenant() {

        await this.showLoading("Creating Tenant XRP account.");
        const tenantAcc = await ripple.createAccount();
        await this.hideLoading();
        if (!tenantAcc)
            return;

        this.setState({
            tenant: {
                account: {
                    addr: tenantAcc.addr
                }
            }
        }, () => storage.persist("tenant", tenantAcc));
    }

    async takeProperty() {

        // Get rental agreement file.
        const file: any = await this.selectFile();
        if (!file)
            return;
        if (file.size > 4 * 1024 * 1024) {
            alert("File has to be less than 4MB.");
            return;
        }

        // Get property's xrp address.
        const propertyXrpAddr: any = await this.scanQR("Scan the Property's XRP address");
        if (!propertyXrpAddr || propertyXrpAddr.length == 0)
            return;

        await this.showLoading("Creating Rental agreement trust lines");

        const s: any = this.state;

        // Generate the NFT.
        const nftHex = await nft.generateRentalAgreementNft(propertyXrpAddr, s.tenant.account.addr, file);

        // Create a trust line from tenant account to property account.
        const lines = [{ fromAddr: s.tenant.account.addr, toAddr: propertyXrpAddr, nftHex: nftHex, secret: storage.get("tenant").seed }]
        const result = await ripple.createTrustLines(lines);
        this.hideLoading();
        if (!result)
            return;

        this.setState((s: any) => ({
            tenant: {
                ...s.tenant,
                property: {
                    account: {
                        addr: propertyXrpAddr
                    }
                }
            }
        }), () => storage.persist("property", (this.state as any).tenant.property.account));
    }

    resetWallet() {
        this.setState({
            owner: null,
            tenant: null
        }, () => storage.clear());
    }

    qrScanResolver: any = null;
    scanQR(title: any) {
        this.qrCodeReceived = false;
        this.setState({
            qrScanner: {
                show: true,
                title: title,
                qrCode: null
            }
        });

        return new Promise(resolve => {
            this.qrScanResolver = resolve;
        })
    }

    hideQRScanner() {
        this.setState({
            qrScanner: {
                show: false,
                title: null,
                qrCode: null
            }
        }, () => {
            this.qrScanResolver(null);
            this.qrScanResolver = null;
        });
    }

    qrCodeReceived: any = false;
    reportQRCode(result: any) {

        if (!result || this.qrCodeReceived)
            return;

        this.qrCodeReceived = true;

        this.setState({
            qrScanner: {
                show: false,
                qrCode: null
            }
        }, () => {
            this.qrScanResolver(result.text);
            this.qrScanResolver = null;
        });
    }

    fileResolver: any = null;
    selectFile() {
        return new Promise(resolve => {
            const picker = document.getElementById("filepicker") as any;
            if (picker) {
                picker.value = "";
                picker.click();
                this.fileResolver = resolve;
            }
            else {
                resolve(null);
            }
        })

    }

    onFileSelected() {
        const picker = document.getElementById("filepicker") as any;
        if (picker && picker.files.length > 0)
            this.fileResolver(picker.files[0]);
        else
            this.fileResolver(null);

        this.fileResolver = null;
    }

    showLoading(title: any) {
        return new Promise<void>(resolve => {
            this.setState({
                loading: {
                    show: true,
                    title: title
                }
            }, () => resolve());
        })
    }

    hideLoading() {
        return new Promise<void>(resolve => {
            this.setState({
                loading: {
                    show: false,
                    title: null
                }
            }, () => resolve());
        })
    }

    render() {

        const { owner, tenant, qrScanner, loading } = this.state as any;

        return (
            <IonPage>
                <IonText className="ion-text-center" color="success">
                    <h1>RentPluz</h1>
                </IonText>
                <div className="container">

                    {!owner && !tenant &&
                        <div className="splash">
                            <div className="section">
                                <IonText color="medium"><small>Load this page from two different devices and follow the Owner and Tenant flows.</small></IonText>
                            </div>
                            <div className="section">
                                <IonButton expand="block" color="success" onClick={this.registerOwner}>Owner</IonButton>
                            </div>
                            <div className="section">
                                <IonButton expand="block" color="success" onClick={this.registerTenant}>Tenant</IonButton>
                            </div>
                        </div>}

                    {owner && <div>
                        <XrpAddress title="Owner registered." addr={owner.account.addr} />
                        {!owner.property && <>
                            <IonButton color="success" onClick={this.registerProperty}>Add Property</IonButton>
                            <div><small>Upload property ownership file.</small></div>
                        </>}
                        {owner.property && <div>
                            <XrpAddress title="Property registered." addr={owner.property.account.addr} />
                            {!owner.property.tenant && <>
                                <IonButton color="success" onClick={this.rentProperty}>Rent Property</IonButton>
                                <div><small>Upload rental agreement file.</small></div>
                            </>}
                            {owner.property.tenant && <XrpAddress title="Property rented to:" addr={owner.property.tenant.account.addr} />}
                        </div>}
                    </div>}

                    {tenant && <div>
                        <XrpAddress title="Tenant registered." addr={tenant.account.addr} />
                        {!tenant.property && <>
                            <IonButton color="success" onClick={this.takeProperty}>Rent a Property</IonButton>
                            <div><small>Upload rental agreement file.</small></div>
                        </>}
                        {tenant.property && <XrpAddress title="Rented the Property:" addr={tenant.property.account.addr} />}
                    </div>}

                    {(owner || tenant) &&
                        <div className="section">
                            <IonButton color="danger" onClick={this.resetWallet}>Reset Wallet</IonButton>
                        </div>}
                </div>
                <IonLoading isOpen={loading.show} message={loading.title} />
                <IonModal isOpen={qrScanner.show} backdropDismiss={false} cssClass='my-custom-class'>
                    <div className="section">{qrScanner.title}</div>
                    <div className="camera-wait-container">
                        <div className="camera-wait">
                            <small>Loading camera...</small>
                        </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <BarcodeScannerComponent
                            width={400}
                            height={400}
                            onUpdate={(err, result) => this.reportQRCode(result)}
                        />
                    </div>
                    <IonButton onClick={this.hideQRScanner}>Close</IonButton>
                </IonModal>
                <input id="filepicker" type="file" style={{ display: "none" }} onChange={this.onFileSelected} />
            </IonPage>
        )
    }
}

export default Home;
