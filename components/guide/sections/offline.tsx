import { WifiOff } from 'lucide-react';
import { GuideSection, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { OfflineQueueDemo } from '../demos/offline-queue-demo';

export function OfflineSection() {
  return (
    <GuideSection
      id="offline"
      icon={WifiOff}
      eyebrow="Platform"
      title="Offline & sync"
      intro="Novira keeps working without an internet connection. Add expenses on the train, in airplane mode, in a basement — they’re saved on your device and quietly catch up the moment you’re back online."
      demo={<OfflineQueueDemo />}
    >
      <h3>What happens when you’re offline</h3>
      <p>
        Every change you make — an add, an edit, a delete — is saved on your device first, then sent to the cloud. If you’re offline when you make the change, Novira holds onto it and sends it later. You don’t need to do anything; nothing is lost.
      </p>

      <FactGrid>
        <FactRow label="What you can do offline">Add, edit, and delete transactions. Browse your history. Open most charts.</FactRow>
        <FactRow label="When it syncs">As soon as your phone or laptop sees the internet again. You can also tap Retry in Settings if you want to push it manually.</FactRow>
        <FactRow label="If a sync fails">Novira tries again a few times, with longer waits in between. After 5 tries, the change is marked failed — head to <strong>Settings → Data Management → Sync status</strong> to try again or discard it.</FactRow>
        <FactRow label="How long things wait">Up to a week. After that, anything still unsent is marked as failed so you can clean it up.</FactRow>
        <FactRow label="How much it can hold">Hundreds of pending changes — far more than you’d typically add while offline.</FactRow>
      </FactGrid>

      <h3>What you’ll see</h3>
      <ul>
        <li><strong>Pending items</strong> look slightly faded and show a small cloud-with-a-slash icon.</li>
        <li>A <strong>sync indicator</strong> at the top of the screen pulses while Novira is catching up.</li>
        <li><strong>Failed items</strong> show up under <strong>Settings → Data Management → Sync status</strong> with two buttons: try again, or discard.</li>
        <li>A small message slides in when sync starts and finishes — quietly, so it doesn’t interrupt you.</li>
      </ul>

      <Callout type="tip" title="You can edit pending items">
        Even before they’ve synced, pending items behave like any other transaction. Edit them, delete them, no problem — Novira sorts out the right thing to send when it’s time.
      </Callout>

      <Callout type="warning" title="If sync gets stuck">
        Open <strong>Settings → Data Management → Sync status</strong>. If one item keeps failing, you can <strong>discard</strong> it (it’s usually a duplicate, or it belongs to a workspace that no longer exists). Everything else will then go through.
      </Callout>
    </GuideSection>
  );
}
