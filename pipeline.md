```mermaid
%%{ init: { 'flowchart': { 'curve': 'monotoneX' } } }%%
graph LR;
coin-data-source[fa:fa-rocket coin-data-source &#8205] --> coin-data{{ fa:fa-arrow-right-arrow-left coin-data &#8205}}:::topic;
coin-data{{ fa:fa-arrow-right-arrow-left coin-data &#8205}}:::topic --> coin-data-transformation[fa:fa-rocket coin-data-transformation &#8205];
coin-data-transformation[fa:fa-rocket coin-data-transformation &#8205] --> updated-coin-data{{ fa:fa-arrow-right-arrow-left updated-coin-data &#8205}}:::topic;


classDef default font-size:110%;
classDef topic font-size:80%;
classDef topic fill:#3E89B3;
classDef topic stroke:#3E89B3;
classDef topic color:white;
```