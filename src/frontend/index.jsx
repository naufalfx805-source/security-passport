import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Badge, Button, Heading, Inline, Lozenge, ProgressBar, SectionMessage, Spinner, Stack, Strong, Text, Textfield,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const PASSPORT_STATUS = {
  open: { text: 'Checks open', appearance: 'moved' },
  complete: { text: 'Complete', appearance: 'success' },
  'not-required': { text: 'No checks needed', appearance: 'default' },
};

const CHECK_STATUS = {
  open: { text: 'Open', appearance: 'moved' },
  done: { text: 'Done', appearance: 'success' },
  accepted: { text: 'Risk accepted', appearance: 'removed' },
};

function CheckRow({ check, busy, onSave }) {
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState('');
  const status = CHECK_STATUS[check.status] || CHECK_STATUS.open;

  const save = async () => {
    const ok = await onSave(check.id, mode, note);
    if (ok) {
      setMode(null);
      setNote('');
    }
  };

  return (
    <Stack space="space.075">
      <Inline space="space.100" alignBlock="center">
        <Lozenge appearance={status.appearance}>{status.text}</Lozenge>
        <Strong>{check.id}</Strong>
        {check.cwe ? <Badge>{check.cwe}</Badge> : null}
        {check.stale ? <Lozenge>No longer in ticket text</Lozenge> : null}
      </Inline>
      <Text>{check.title}</Text>
      <Text>How to verify: {check.verify}</Text>
      {check.status !== 'open' ? <Text>{check.status === 'done' ? 'Evidence' : 'Justification'}: {check.note}</Text> : null}
      {mode ? (
        <Stack space="space.050">
          <Textfield
            placeholder={mode === 'done' ? 'Evidence: test name, pull request link or review note' : 'Why is this risk acceptable? (at least 20 characters)'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Inline space="space.100">
            <Button appearance="primary" isDisabled={busy} onClick={save}>Save</Button>
            <Button appearance="subtle" onClick={() => setMode(null)}>Cancel</Button>
          </Inline>
        </Stack>
      ) : (
        <Inline space="space.100">
          {check.status === 'open' ? (
            <>
              <Button isDisabled={busy} onClick={() => setMode('done')}>Mark done</Button>
              <Button appearance="subtle" isDisabled={busy} onClick={() => setMode('accepted')}>Accept risk</Button>
            </>
          ) : (
            <Button appearance="subtle" isDisabled={busy} onClick={() => onSave(check.id, 'open', '')}>Reopen</Button>
          )}
        </Inline>
      )}
    </Stack>
  );
}

const App = () => {
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (name, payload) => {
    setBusy(true);
    setError(null);
    try {
      const result = await invoke(name, payload);
      setPassport(result.passport);
      return true;
    } catch (e) {
      setError(e?.message || String(e));
      return false;
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    run('getPassport');
  }, []);

  if (loading) return <Spinner label="Loading Security Passport" />;

  const status = PASSPORT_STATUS[passport?.status] || PASSPORT_STATUS['not-required'];
  const total = passport?.total || 0;

  return (
    <Stack space="space.200">
      {error ? <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage> : null}
      <Inline space="space.100" alignBlock="center" spread="space-between">
        <Inline space="space.100" alignBlock="center">
          <Lozenge appearance={status.appearance}>{status.text}</Lozenge>
          {total > 0 ? <Text>{passport.doneCount} of {total} checks closed</Text> : null}
        </Inline>
        <Button appearance="subtle" isDisabled={busy} onClick={() => run('rescan')}>Re-scan ticket</Button>
      </Inline>
      {total > 0 ? <ProgressBar value={passport.doneCount / total} /> : null}
      {passport?.status === 'not-required' ? (
        <SectionMessage appearance="information">
          <Text>Nothing in this ticket points to a security-sensitive change. If it touches sign-in, uploads, URL fetching, payments, secrets or personal data, describe that in the ticket or add a label such as security-passport:ssrf, then re-scan.</Text>
        </SectionMessage>
      ) : null}
      {(passport?.detected || []).map((area) => (
        <Stack key={area.id} space="space.050">
          <Heading size="xsmall">{area.label}</Heading>
          <Text>Detected from: {area.matches.join(', ')}{area.stale ? ' (no longer in the ticket text)' : ''}</Text>
          {passport.checks.filter((c) => c.area === area.id).map((check) => (
            <CheckRow
              key={check.id}
              check={check}
              busy={busy}
              onSave={(checkId, newStatus, note) => run('updateCheck', { checkId, status: newStatus, note })}
            />
          ))}
        </Stack>
      ))}
      {passport?.status === 'open' ? (
        <SectionMessage appearance="warning">
          <Text>When the Security Passport validator is added to the workflow, this issue cannot move to Done until every check is done or has an accepted risk.</Text>
        </SectionMessage>
      ) : null}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
