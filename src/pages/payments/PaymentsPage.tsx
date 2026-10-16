import { useEffect, useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonCard, IonCardContent, IonInput, IonButton, IonText, IonSpinner } from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { AppBackButton } from '../../navigation/AppBackButton';
import { paymentsApi } from '../../data/network/PaymentsApi';
import type { PaymentNetwork, PaymentOrder, WithdrawalQuote } from '../../data/network/PaymentsApi';
import { getUserAccount } from '../../data/auth/AuthSessionStore';

const labels: Record<string, string> = { created: 'Creada', submitting: 'Enviando', waiting: 'Esperando pago', confirming: 'Confirmando',
  pending_verify: 'Confirma con el código de tu correo', review: 'En revisión', reserved: 'Saldo reservado', processing: 'Procesando',
  verification_pending: 'Procesando', confirmed: 'Confirmada', rejected: 'Rechazada', partially_paid: 'Pago parcial', expired: 'Expirada',
  failed: 'Fallida', refunded: 'Devuelta', uncertain: 'Estamos verificando el resultado', verification_delivery_failed: 'No se pudo entregar el código' };
const terminal = new Set(['confirmed', 'rejected', 'failed', 'refunded', 'expired', 'verification_delivery_failed']);
const usdt = (value?: string) => `${value ?? '0.000000'} USDT`;

export default function PaymentsPage() {
  const location = useLocation();
  const historyMode = location.pathname === '/history';
  const withdrawalMode = location.pathname.startsWith('/withdrawal');
  const title = historyMode ? 'Movimientos USDT' : withdrawalMode ? 'Retirar USDT' : 'Depositar USDT';
  const owner = getUserAccount()?.id ?? '';
  const storageKey = `p4c:payment:${owner}:${withdrawalMode ? 'withdrawal' : 'deposit'}`;
  const [networks, setNetworks] = useState<PaymentNetwork[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnRequested, setReturnRequested] = useState(false);
  const [network, setNetwork] = useState('');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [balance, setBalance] = useState({ available: '0.000000', reserved: '0.000000' });
  const [quote, setQuote] = useState<WithdrawalQuote | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const remember = (next: PaymentOrder) => { setOrder(next); sessionStorage.setItem(`${storageKey}:order`, next.id); };
  const perform = async (work: () => Promise<void>) => {
    setLoading(true); setError('');
    try { await work(); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  const requestKey = (input: unknown) => {
    const serialized = JSON.stringify(input);
    const saved = JSON.parse(sessionStorage.getItem(`${storageKey}:request`) ?? 'null');
    if (saved?.input === serialized) return saved.key as string;
    const key = crypto.randomUUID();
    sessionStorage.setItem(`${storageKey}:request`, JSON.stringify({ key, input: serialized }));
    return key;
  };
  useEffect(() => {
    let active = true;
    setOrder(null); setQuote(null); setError('');
    (async () => {
      try {
        const funds = await paymentsApi.balance();
        if (active) setBalance(funds);
        if (historyMode) { const rows = await paymentsApi.history(); if (active) setOrders(rows); return; }
        const rows = await paymentsApi.networks();
        if (active) {
          setNetworks(rows); setNetwork(rows[0]?.network ?? '');
          if (!rows.length) setError('NOWPayments no devolvió redes USDT habilitadas. Revisa las monedas de la cuenta sandbox en Settings → Coins.');
        }
        const id = sessionStorage.getItem(`${storageKey}:order`);
        if (id) { const current = await paymentsApi.order(id); if (active) setOrder(current); }
      } catch (e) { if (active) setError((e as Error).message); }
    })();
    return () => { active = false; };
  }, [historyMode, storageKey]);
  useEffect(() => {
    if (!order || terminal.has(order.status)) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const [next, funds] = await Promise.all([paymentsApi.order(order.id), paymentsApi.balance()]);
        if (active) { setOrder(next); setBalance(funds); }
      } catch { /* Keep the last known status while the connection recovers. */ }
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [order?.id, order?.status]);
  const validAmount = /^\d{1,18}(\.\d{1,6})?$/.test(amount) && /[1-9]/.test(amount);
  return <IonPage><IonHeader><IonToolbar><IonButtons slot="start"><AppBackButton to="/dashboard" /></IonButtons><IonTitle>{title}</IonTitle></IonToolbar></IonHeader>
    <IonContent className="ion-padding">
      <IonCard><IonCardContent><strong>Pagos de prueba · NOWPayments sandbox</strong>
        <p>Estos pagos y saldos son ficticios. No envíes criptomonedas reales a las direcciones mostradas. El proveedor simula el resultado del depósito.</p>
      </IonCardContent></IonCard>
      <IonCard><IonCardContent>Disponible: <strong>{usdt(balance.available)}</strong><br />Reservado para retiros: {usdt(balance.reserved)}</IonCardContent></IonCard>
      {error && <IonText color="danger"><p role="alert">{error}</p></IonText>}
      {historyMode ? orders.map(row => <IonCard key={row.id}><IonCardContent>
        <strong>{row.kind === 'deposit' ? 'Depósito' : 'Retiro'} · {row.network}</strong><p>{usdt(row.kind === 'deposit' ? row.credited ?? row.amount : row.amount)}</p>
        <p>{labels[row.status] ?? row.status}</p><time>{new Date(row.createdAt).toLocaleString()}</time>
      </IonCardContent></IonCard>) : <>
        {!order && <IonCard><IonCardContent>
          <label htmlFor="payment-network">Red de USDT</label><select id="payment-network" disabled={!networks.length || loading} value={network} onChange={e => { setNetwork(e.target.value); setQuote(null); }} style={{ display: 'block', width: '100%', padding: 12, margin: '10px 0', backgroundColor: 'var(--ion-background-color)', color: 'var(--ion-text-color)' }}>
            {!networks.length && <option value="">No hay redes USDT disponibles</option>}
            {networks.map(n => <option key={n.network} value={n.network}>{n.network}</option>)}
          </select>
          <IonInput label={withdrawalMode ? 'USDT que deseas recibir' : 'Importe USDT'} labelPlacement="stacked" inputmode="decimal" value={amount}
            onIonInput={e => { setAmount(String(e.detail.value ?? '')); setQuote(null); }} />
          {withdrawalMode && <IonInput label="Dirección de destino" labelPlacement="stacked" value={address} onIonInput={e => { setAddress(String(e.detail.value ?? '')); setQuote(null); }} />}
          {withdrawalMode ? <>
            {!quote && <IonButton disabled={loading || !validAmount || !network || address.length < 10} onClick={() => perform(async () => { setQuote(await paymentsApi.quote(network, address, amount)); })}>Calcular comisión</IonButton>}
            {quote && <div><p>Red: {quote.network}</p><p>Recibes: <strong>{usdt(quote.net)}</strong></p><p>Comisión: {usdt(quote.fee)}</p><p>Total a descontar: <strong>{usdt(quote.amount)}</strong></p>
              <IonButton disabled={loading || new Date(quote.expiresAt).getTime() <= Date.now()} onClick={() => perform(async () => remember(await paymentsApi.withdraw(requestKey({ quoteId: quote.id }), quote.id)))}>Confirmar retiro</IonButton>
              <IonButton fill="clear" disabled={loading} onClick={() => setQuote(null)}>Actualizar cotización</IonButton>
            </div>}
          </> : <IonButton disabled={loading || !validAmount || !network} onClick={() => perform(async () => remember(await paymentsApi.deposit(requestKey({ network, amount }), network, amount)))}>Crear depósito</IonButton>}
          <p>Comprueba que la dirección corresponde a la red seleccionada.</p>
        </IonCardContent></IonCard>}
        {order && <IonCard><IonCardContent>
          <h2>{labels[order.status] ?? order.status}</h2><p>Red: {order.network}</p>
          {order.kind === 'deposit' && order.address && <><QRCodeSVG value={order.address} size={180} /><p style={{ overflowWrap: 'anywhere' }}>{order.address}</p>
            <IonButton onClick={() => navigator.clipboard.writeText(order.address!)}>Copiar dirección</IonButton><p>Importe simulado: <strong>{usdt(order.payAmount)}</strong></p><p>El saldo se acreditará con el importe neto confirmado.</p></>}
          {order.kind === 'withdrawal' && <><p>Recibes: {usdt(order.net)}</p><p>Comisión: {usdt(order.fee)}</p><p>Total: {usdt(order.amount)}</p></>}
          {order.status === 'pending_verify' && <><IonInput label="Código del correo" labelPlacement="stacked" inputmode="numeric" maxlength={6} value={code} onIonInput={e => setCode(String(e.detail.value ?? ''))} />
            <IonButton disabled={loading || !/^\d{6}$/.test(code)} onClick={() => perform(async () => remember(await paymentsApi.verify(order.id, code, requestKey({ verifyOrderId: order.id }))))}>Verificar</IonButton></>}
          {terminal.has(order.status) && <IonButton onClick={() => { sessionStorage.removeItem(`${storageKey}:order`); sessionStorage.removeItem(`${storageKey}:request`); setOrder(null); setQuote(null); }}>Nueva operación</IonButton>}
          {order.reviewReason === 'provider_rejected' && <p>NOWPayments rechazó esta operación. No se completó el pago.</p>}
          {order.status === 'uncertain' && <p>Conserva esta operación mientras verificamos el resultado.</p>}
        </IonCardContent></IonCard>}
      </>}
      {(withdrawalMode || historyMode) && <IonCard><IonCardContent>
        <h2>Devolución supervisada</h2>
        <p>Si el proveedor rechaza una operación o necesitas ayuda con fondos existentes, puedes solicitar una revisión.</p>
        {returnRequested ? <p>Solicitud registrada para revisión. El saldo se conserva.</p> : <>
          <IonInput label="Motivo de la solicitud" labelPlacement="stacked" value={returnReason} maxlength={500} onIonInput={e => setReturnReason(String(e.detail.value ?? ''))} />
          <IonButton disabled={loading || returnReason.trim().length < 10} onClick={() => perform(async () => {
            await paymentsApi.requestReturn(requestKey({ returnReason }), returnReason); setReturnRequested(true);
          })}>Solicitar revisión de devolución</IonButton>
        </>}
      </IonCardContent></IonCard>}
      {loading && <IonSpinner aria-label="Procesando" />}
    </IonContent></IonPage>;
}
