import { useState } from 'react';
import { router } from '@forge/bridge';
import SectionMessage, { SectionMessageAction } from '@atlaskit/section-message';
import { Text } from '@atlaskit/primitives';
import { call, errorText } from '../api';
import { t } from '../i18n';
import { useToast } from '../Toast';

export const APP_NAME = 'AccessRadar';

type Answer = 'dismissed' | 'done';

/**
 * Radrly standard Marketplace review request: one discovery SectionMessage, no X, no link in the
 * body, three labelled actions. The parent owns the trigger and the persistence.
 */
export function ReviewPromptMessage({
  url,
  onAnswer,
  open = (u: string) => void router.open(u),
}: {
  url: string;
  onAnswer: (answer: Answer) => void;
  open?: (url: string) => void;
}) {
  const appName = APP_NAME;
  return (
    <SectionMessage
      appearance="discovery"
      title={t('reviewPrompt.title', { appName })}
      headingLevel="h2"
      actions={[
        <SectionMessageAction
          key="open"
          href={url}
          onClick={(event) => {
            event.preventDefault();
            onAnswer('done');
            open(url);
          }}
        >
          {t('reviewPrompt.open')}
        </SectionMessageAction>,
        <SectionMessageAction key="done" onClick={() => onAnswer('done')}>
          {t('reviewPrompt.alreadyDone')}
        </SectionMessageAction>,
        <SectionMessageAction key="dismiss" onClick={() => onAnswer('dismissed')}>
          {t('reviewPrompt.dismiss')}
        </SectionMessageAction>,
      ]}
    >
      <Text as="p">{t('reviewPrompt.body', { appName })}</Text>
    </SectionMessage>
  );
}

/** Stores the answer once per site and hides the request at once, for good. No tracking. */
export function ReviewPrompt({ url }: { url: string }) {
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const answer = async (choice: Answer) => {
    setHidden(true);
    try {
      await call('answerReviewPrompt', { choice });
    } catch (e) {
      setHidden(false);
      toast.error(errorText(e));
    }
  };
  return <ReviewPromptMessage url={url} onAnswer={(choice) => void answer(choice)} />;
}
