import { useState } from 'react';
import { router } from '@forge/bridge';
import SectionMessage, { SectionMessageAction } from '@atlaskit/section-message';
import { Text } from '@atlaskit/primitives';
import { call, errorText } from '../api';
import { t } from '../i18n';
import { useToast } from '../Toast';

/**
 * One-time, dismissible request for a Marketplace review, shown to a site admin after first value.
 * A plain link: no tracking, no incentive, never blocks a review, remediation or sign-off.
 */
export function ReviewPrompt({ url }: { url: string }) {
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const answer = async (choice: 'dismissed' | 'done') => {
    setHidden(true);
    try {
      await call('answerReviewPrompt', { choice });
    } catch (e) {
      setHidden(false);
      toast.error(errorText(e));
    }
  };
  return (
    <SectionMessage
      appearance="discovery"
      title={t('reviewPrompt.title')}
      headingLevel="h2"
      actions={[
        <SectionMessageAction
          key="open"
          onClick={() => {
            void router.open(url);
            void answer('done');
          }}
        >
          {t('reviewPrompt.open')}
        </SectionMessageAction>,
        <SectionMessageAction key="done" onClick={() => void answer('done')}>
          {t('reviewPrompt.alreadyDone')}
        </SectionMessageAction>,
        <SectionMessageAction key="dismiss" onClick={() => void answer('dismissed')}>
          {t('reviewPrompt.dismiss')}
        </SectionMessageAction>,
      ]}
    >
      <Text as="p">{t('reviewPrompt.body')}</Text>
    </SectionMessage>
  );
}
