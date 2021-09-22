import * as React from 'react';

type Props = {
  content: [string, React.ReactElement][];
  defaultTab?: string;
};

type State = {
  selectedTab: string;
};

export default class Tabs extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { selectedTab: props.defaultTab ?? props.content[0][0] };
  }

  render(): React.ReactNode {
    const selectedContent = this.props.content.find(
      ([tabName]) => tabName === this.state.selectedTab,
    )?.[1];

    return (
      <div className="tabs-container">
        <div className="tab-chooser">
          {this.props.content.map(([tabName]) => (
            <div key={tabName}>{tabName}</div>
          ))}
        </div>
        <div className="selected-content">{selectedContent}</div>
      </div>
    );
  }
}
