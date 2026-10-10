import { useCallback, useState, type ReactNode } from 'react';
import Button from '@atlaskit/button/new';
import ModalDialog, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from '@atlaskit/modal-dialog';

type ConfirmRequest = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** May be async. Handle errors inside (toast); the dialog closes once it settles. */
  onConfirm: () => Promise<unknown> | void;
};

/**
 * Standard confirmation for destructive actions: an ADS modal with a danger confirm button.
 * Usage: `const [confirmDialog, confirm] = useConfirm();` render `{confirmDialog}` once and call
 * `confirm({ title, body, confirmLabel, onConfirm })`.
 */
export function useConfirm(): [ReactNode, (request: ConfirmRequest) => void] {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = useCallback((next: ConfirmRequest) => setRequest(next), []);
  const close = () => {
    if (!busy) setRequest(null);
  };

  const dialog = (
    <ModalTransition>
      {request ? (
        <ModalDialog width="small" onClose={close} label={request.title}>
          <ModalHeader hasCloseButton>
            <ModalTitle appearance="danger">{request.title}</ModalTitle>
          </ModalHeader>
          <ModalBody>{request.body}</ModalBody>
          <ModalFooter>
            <Button appearance="subtle" isDisabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button
              appearance="danger"
              isLoading={busy}
              onClick={() => {
                setBusy(true);
                void Promise.resolve(request.onConfirm()).finally(() => {
                  setBusy(false);
                  setRequest(null);
                });
              }}
            >
              {request.confirmLabel}
            </Button>
          </ModalFooter>
        </ModalDialog>
      ) : null}
    </ModalTransition>
  );

  return [dialog, ask];
}
