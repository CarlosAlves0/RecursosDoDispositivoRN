import React, { useEffect, useState, useCallback, ReactNode } from 'react';
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Accelerometer } from 'expo-sensors';

/* ------------------------------------------------------------------ */
/* Notificações: como exibir quando o app está aberto                  */
/* ------------------------------------------------------------------ */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */
type ScreenName = 'home' | 'photo' | 'location' | 'sensor' | 'haptic';

type Option = {
  key: Exclude<ScreenName, 'home'>;
  title: string;
  desc: string;
};

type BackProps = { onBack: () => void };

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
};

type MessageProps = { text: string; kind?: 'error' | 'ok' };

type ScreenProps = BackProps & {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

type Axes = { x: number; y: number; z: number };

/* ------------------------------------------------------------------ */
/* Cores e componentes básicos                                         */
/* ------------------------------------------------------------------ */
const C = {
  bg: '#EEF2F1',
  ink: '#12332E',
  muted: '#5C7570',
  card: '#FFFFFF',
  accent: '#0F766E',
  accentText: '#FFFFFF',
  errorBg: '#FDECEA',
  errorInk: '#8A1C12',
  okBg: '#E3F4EF',
  line: '#CFDCD9',
} as const;

function Button({ title, onPress, disabled, variant = 'solid' }: ButtonProps) {
  const outline = variant === 'outline';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        outline && s.btnOutline,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.btnText, outline && { color: C.accent }]}>{title}</Text>
    </Pressable>
  );
}

function Message({ text, kind = 'error' }: MessageProps) {
  if (!text) return null;
  const isError = kind === 'error';
  return (
    <View style={[s.msg, { backgroundColor: isError ? C.errorBg : C.okBg }]}>
      <Text style={{ color: isError ? C.errorInk : C.ink, fontSize: 15, lineHeight: 21 }}>
        {text}
      </Text>
    </View>
  );
}

function Screen({ title, subtitle, onBack, children }: ScreenProps) {
  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={onBack} style={s.back} accessibilityRole="button">
        <Text style={s.backText}>‹ Voltar</Text>
      </Pressable>
      <Text style={s.h1}>{title}</Text>
      {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>{children}</ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 1) FOTO                                                             */
/* ------------------------------------------------------------------ */
function PhotoScreen({ onBack }: BackProps) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const fromCamera = async (): Promise<void> => {
    setError('');
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError(
          'Sem permissão para usar a câmera. Você ainda pode escolher uma foto da galeria, ou liberar a câmera nas configurações do celular.'
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!res.canceled) setUri(res.assets[0].uri);
    } catch {
      setError('Não foi possível abrir a câmera neste aparelho. Tente escolher da galeria.');
    }
  };

  const fromGallery = async (): Promise<void> => {
    setError('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(
          'Sem permissão para acessar suas fotos. Libere o acesso nas configurações do celular ou tire uma foto com a câmera.'
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!res.canceled) setUri(res.assets[0].uri);
    } catch {
      setError('Não foi possível abrir a galeria. Tente novamente.');
    }
  };

  return (
    <Screen title="Foto" subtitle="Tire uma foto ou escolha uma imagem da galeria." onBack={onBack}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Button title="Câmera" onPress={fromCamera} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Galeria" onPress={fromGallery} variant="outline" />
        </View>
      </View>
      <Message text={error} />
      {uri ? (
        <Image source={{ uri }} style={s.photo} resizeMode="cover" />
      ) : (
        <View style={[s.photo, s.photoEmpty]}>
          <Text style={{ color: C.muted }}>Nenhuma imagem selecionada</Text>
        </View>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 2) LOCALIZAÇÃO                                                      */
/* ------------------------------------------------------------------ */
function LocationScreen({ onBack }: BackProps) {
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const getLocation = async (): Promise<void> => {
    setError('');
    setCoords(null);
    setLoading(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setError(
          'Sem permissão de localização. Para ver latitude e longitude, libere a localização do app nas configurações do celular.'
        );
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setError('O GPS do aparelho está desligado. Ative a localização e tente de novo.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords(pos.coords);
    } catch {
      setError('Não foi possível obter sua localização agora. Verifique o GPS e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Localização" subtitle="Veja sua posição atual (somente com o app aberto)." onBack={onBack}>
      <Button title={loading ? 'Buscando…' : 'Obter localização'} onPress={getLocation} disabled={loading} />
      <Message text={error} />
      {coords && (
        <View style={s.card}>
          <Text style={s.label}>Latitude</Text>
          <Text style={s.value}>{coords.latitude.toFixed(6)}</Text>
          <Text style={[s.label, { marginTop: 12 }]}>Longitude</Text>
          <Text style={s.value}>{coords.longitude.toFixed(6)}</Text>
        </View>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 3) SENSOR (acelerômetro)                                            */
/* ------------------------------------------------------------------ */
const AXES: (keyof Axes)[] = ['x', 'y', 'z'];

function SensorScreen({ onBack }: BackProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [running, setRunning] = useState<boolean>(true);
  const [data, setData] = useState<Axes>({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    let sub: ReturnType<typeof Accelerometer.addListener> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const ok = await Accelerometer.isAvailableAsync();
        if (cancelled) return;
        setAvailable(ok);
        if (!ok || !running) return;
        Accelerometer.setUpdateInterval(200);
        sub = Accelerometer.addListener((m) => setData({ x: m.x, y: m.y, z: m.z }));
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();

    // cleanup: remove o listener ao sair da tela ou pausar
    return () => {
      cancelled = true;
      if (sub) sub.remove();
    };
  }, [running]);

  return (
    <Screen title="Sensor" subtitle="Acelerômetro em tempo real. Mexa o celular." onBack={onBack}>
      {available === false && (
        <Message text="Este aparelho não tem acelerômetro disponível. As outras funções continuam funcionando." />
      )}
      <View style={s.card}>
        {AXES.map((axis) => (
          <View key={axis} style={s.axisRow}>
            <Text style={s.axis}>{axis.toUpperCase()}</Text>
            <Text style={s.value}>{data[axis].toFixed(3)}</Text>
          </View>
        ))}
      </View>
      <Button
        title={running ? 'Pausar leitura' : 'Retomar leitura'}
        onPress={() => setRunning((r) => !r)}
        variant="outline"
        disabled={available === false}
      />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 4) HÁPTICO + DESAFIO: notificação local                             */
/* ------------------------------------------------------------------ */
function HapticScreen({ onBack }: BackProps) {
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [working, setWorking] = useState<boolean>(false);

  const completeAction = async (): Promise<void> => {
    setError('');
    setStatus('');
    setWorking(true);

    try {
      // Simula uma ação (ex.: salvar) que leva um instante.
      await new Promise<void>((resolve) => setTimeout(resolve, 800));

      // A ação é concluída mesmo se o aparelho não suportar háptica.
      setStatus('Ação concluída!');

      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } catch {
        setError(
          'A ação foi concluída, mas este aparelho não conseguiu executar a vibração tátil.'
        );
      }
    } catch {
      setError('Não foi possível concluir a ação. Tente novamente.');
    } finally {
      setWorking(false);
    }
  };

  const scheduleNotification = async (): Promise<void> => {
    setError('');
    setStatus('');
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Padrão',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      // 1) verifica a permissão atual
      let { status: current } = await Notifications.getPermissionsAsync();
      // 2) solicita se ainda não foi concedida
      if (current !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        current = req.status;
      }
      if (current !== 'granted') {
        setError(
          'Sem permissão para notificações. Libere as notificações do app nas configurações do celular para agendar o lembrete.'
        );
        return;
      }

      // 3) só agora agenda (disparado pelo toque no botão)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Recursos do Dispositivo',
          body: 'Este é o lembrete que você agendou.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
          channelId: 'default',
        },
      });
      setStatus('Notificação agendada para daqui a 5 segundos.');
    } catch {
      setError('Não foi possível agendar a notificação neste aparelho.');
    }
  };

  return (
    <Screen
      title="Háptico"
      subtitle="Sinta a confirmação ao concluir uma ação e teste uma notificação local."
      onBack={onBack}
    >
      <Button title={working ? 'Processando…' : 'Concluir ação'} onPress={completeAction} disabled={working} />
      <View style={{ height: 12 }} />
      <Button title="Agendar notificação (5 s)" onPress={scheduleNotification} variant="outline" />
      <Message text={error} />
      <Message text={status} kind="ok" />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Tela principal                                                      */
/* ------------------------------------------------------------------ */
const OPTIONS: Option[] = [
  { key: 'photo', title: 'Foto', desc: 'Câmera ou galeria' },
  { key: 'location', title: 'Localização', desc: 'Latitude e longitude' },
  { key: 'sensor', title: 'Sensor', desc: 'Acelerômetro X, Y, Z' },
  { key: 'haptic', title: 'Háptico', desc: 'Vibração e notificação' },
];

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const goHome = useCallback(() => setScreen('home'), []);

  // botão voltar do Android
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen !== 'home') {
        setScreen('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen]);

  let content: ReactNode;
  if (screen === 'photo') content = <PhotoScreen onBack={goHome} />;
  else if (screen === 'location') content = <LocationScreen onBack={goHome} />;
  else if (screen === 'sensor') content = <SensorScreen onBack={goHome} />;
  else if (screen === 'haptic') content = <HapticScreen onBack={goHome} />;
  else
    content = (
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Recursos do Dispositivo</Text>
        <Text style={s.sub}>Escolha um recurso para testar.</Text>
        <View style={s.grid}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => setScreen(o.key)}
              style={({ pressed }) => [s.tile, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Text style={s.tileTitle}>{o.title}</Text>
              <Text style={s.tileDesc}>{o.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />      <View style={s.container}>{content}</View>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, marginTop: 12 },
  h1: { fontSize: 26, fontWeight: '800', color: C.ink },
  sub: { fontSize: 16, color: C.muted, marginTop: 6, marginBottom: 20, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tile: {
    width: '47%',
    minHeight: 130,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: C.line,
  },
  tileTitle: { fontSize: 20, fontWeight: '700', color: C.ink },
  tileDesc: { fontSize: 14, color: C.muted, marginTop: 4 },
  back: { paddingVertical: 10, alignSelf: 'flex-start' },
  backText: { color: C.accent, fontSize: 17, fontWeight: '600' },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: C.accent },
  btnOutline: { backgroundColor: 'transparent' },
  btnText: { color: C.accentText, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  msg: { borderRadius: 12, padding: 14, marginTop: 16 },
  photo: { width: '100%', height: 340, borderRadius: 16, marginTop: 16, backgroundColor: C.line },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginVertical: 16, borderWidth: 1, borderColor: C.line },
  label: { fontSize: 14, color: C.muted },
  value: { fontSize: 24, fontWeight: '700', color: C.ink },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  axis: { fontSize: 20, fontWeight: '800', color: C.accent, width: 40 },
});
