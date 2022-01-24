import * as React from "react";
import { ArrowRight, Eye } from "phosphor-react";

import Button from "../../components/Button";
import Range from "../../helpers/Range";
import QuickColumn from "./QuickColumn";
import QuickRow from "./QuickRow";

const ViewSecretPhrasePanel: React.FunctionComponent<{
  secretPhrase: string[];
  onComplete: () => void;
}> = ({ secretPhrase, onComplete }) => {
  const [expanded, setExpanded] = React.useState(false);

  const classes = ["view-secret-phrase-panel"];

  if (expanded) {
    classes.push("expanded");
  }

  return (
    <div className="view-secret-phrase-panel">
      <div className="mb-10">
        <div className="font-bold">
          Congratulations!
          <br />
          You have created a wallet.
        </div>
        <span>
          Below is your secret recovery phrase, which you will need when
          restoring your wallets should you lose access.
        </span>
      </div>
      {expanded && (
        <div className="secret-phrase-box">
          {Range(4).map((i) => (
            <QuickRow key={`row${i}`}>
              {Range(3).map((j) => (
                <QuickColumn key={`column${j}`}>
                  {3 * i + j + 1}. {secretPhrase[3 * i + j]}
                </QuickColumn>
              ))}
            </QuickRow>
          ))}
        </div>
      )}
      {!expanded && (
        <div className="show-box">
          <div style={{ display: "inline-block" }}>
            <Button
              onPress={() => setExpanded(true)}
              className="btn-secondary"
              icon={<Eye className="icon-md" />}
            >
              Show secret phrase
            </Button>
          </div>
        </div>
      )}
      {expanded && (
        <div className="hide-box">
          <QuickRow>
            <Button
              className="btn-secondary"
              onPress={() => setExpanded(false)}
            >
              Hide secret phrase
            </Button>
            <Button
              onPress={onComplete}
              className="btn-primary"
              icon={<ArrowRight className="icon-md" />}
            >
              Review secret phrase
            </Button>
          </QuickRow>
        </div>
      )}
    </div>
  );
};

export default ViewSecretPhrasePanel;
