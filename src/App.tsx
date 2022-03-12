import React from "react";
import axios from "axios";
import {
  Alert,
  Button,
  FormField,
  Heading,
  KeyOptionIcon,
  Pane,
  TextareaField,
  TextInputField,
} from "evergreen-ui";
import { useMutation, useQuery } from "react-query";
import "./App.css";
import { SelectLocationMenu } from "./SelectLocationMenu";
import { DOMMessage, DOMMessageResponse } from "../types/DOMMessages";
import { appendDataBefore } from "./utilities";

interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url?: any;
  type: string;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

interface GitHubCommit {
  sha: any;
  content: string;
  message: string;
  committer: {
    name: string;
    email: string;
  };
}

interface UserOptions {
  githubUsername: string;
  githubRepoName: string;
  githubToken: string;
}

const config = {
  GITHUB_BASE_URL: process.env.GITHUB_BASE_URL || "https://api.github.com",
  GITHUB_REPO_DEFAULT_FILE: process.env.GITHUB_REPO_DEFAULT_FILE || "README.md", //case sensitive
};

const retrieveUserGitHubProfile = async (userName: string) => {
  const repoUrl = `${config.GITHUB_BASE_URL}/users/${userName}`;
  try {
    const { data } = await axios.get(repoUrl);
    return Promise.resolve(data);
  } catch (error) {
    console.log("error retrieveUserGitHubProfile:>> ", error);
  }
};

const retrieveRepositoryContents = async (
  repoOwner: string,
  repoName: string
) => {
  const repoUrl = `${config.GITHUB_BASE_URL}/repos/${repoOwner}/${repoName}/contents`;
  try {
    const { data } = await axios.get(repoUrl);
    return Promise.resolve(data);
  } catch (error) {
    console.log("error retrieveRepositoryContents:>> ", error);
  }
};

const retrieveREADMEContents = async (
  repoOwner: string,
  repoName: string,
  readmeFilePath: string
) => {
  const repoUrl = `${config.GITHUB_BASE_URL}/repos/${repoOwner}/${repoName}/contents/${readmeFilePath}`;
  try {
    const { data } = await axios.get(repoUrl);
    return Promise.resolve(data);
  } catch (error) {
    console.log("error retrieveREADMEContents:>> ", error);
  }
};

const postUpdatedContents = async ({
  repoOwner,
  repoName,
  readmeFilePath,
  githubAccessToken,
  gitHubCommit,
}: any) => {
  const repoUrl = `${config.GITHUB_BASE_URL}/repos/${repoOwner}/${repoName}/contents/${readmeFilePath}`;
  try {
    const { data } = await axios.put(repoUrl, gitHubCommit, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `token ${githubAccessToken}`,
      },
    });
    return Promise.resolve(data);
  } catch (error) {
    console.log("error retrieveREADMEContents:>> ", error);
  }
};

function App() {
  const [domContentResponse, setDomContentResponse] =
    React.useState<DOMMessageResponse>({
      title: "",
      description: "",
      headlines: "",
      url: "",
      websiteName: "",
      favicon: "" as any,
    });
  const [userOptions, setUserOptions] = React.useState<UserOptions>({
    githubUsername: "",
    githubRepoName: "",
    githubToken: "",
  });
  React.useEffect(() => {
    /**
     * We can't use "chrome.runtime.sendMessage" for sending messages from React.
     * For sending messages from React we need to specify which tab to send it to.
     */
    chrome.tabs &&
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          /**
           * Sends a single message to the content script(s) in the specified tab,
           * with an optional callback to run when a response is sent back.
           *
           * The runtime.onMessage event is fired only when title is missing.
           */
          if (!domContentResponse.title) {
            chrome.tabs.sendMessage(
              tabs[0].id || 0,
              {
                type: "GET_DOM",
                favIconUrl: tabs[0].favIconUrl,
                url: tabs[0].url,
                title: tabs[0].title,
              } as DOMMessage,
              (response: DOMMessageResponse) => {
                setDomContentResponse(response);
              }
            );
          }
        }
      );
  });

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      chrome.storage.sync.get(
        {
          githubUsername: "githubUsername",
          githubRepoName: "githubRepoName",
          githubToken: "githubToken",
        },
        (options: any) => setUserOptions(options)
      );
    }
  }, []);

  function toggleDark() {
    if (!document.body.getAttribute("data-ext-dark")) {
      document.body.setAttribute("data-ext-dark", "true");
      document.body.style.backgroundColor = "#000";
      document.body.style.color = "#fff";
    } else {
      document.body.setAttribute("data-ext-dark", "false");
      document.body.style.backgroundColor = "#fff";
      document.body.style.color = "#000";
    }
  }

  React.useEffect(() => {
    chrome.commands.onCommand.addListener((command) => {
      if (command === "hello") {
        console.log("Hello there!");
      }
    });

    chrome.action.onClicked.addListener((tab) => {
      console.log("tab :>> ", tab);
      //TODO toggle dark mode in the tab
      chrome.scripting.executeScript({
        target: { tabId: tab.id as number },
        func: toggleDark,
      });
    });
  }, []);

  const { data: userGitHubTokenProfile } = useQuery(
    ["github-profile"],
    () => retrieveUserGitHubProfile(userOptions.githubUsername),
    { enabled: userOptions.githubUsername ? true : false }
  );
  const { data: repo } = useQuery(
    ["repo"],
    () =>
      retrieveRepositoryContents(
        userOptions.githubUsername,
        userOptions.githubRepoName
      ),
    {
      enabled:
        userOptions.githubUsername && userOptions.githubRepoName ? true : false,
    }
  );
  const [selectedItems, setSelectedItems] = React.useState<(string | number)[]>(
    []
  );
  const [archivingStatus, setBookMarkingStatus] =
    React.useState<boolean>(false);
  const mutation = useMutation(postUpdatedContents);

  const handleSubmission = async () => {
    setBookMarkingStatus(true);
    if (selectedItems.length === 0) {
      const { content, sha } = await retrieveREADMEContents(
        userOptions.githubUsername,
        userOptions.githubRepoName,
        config.GITHUB_REPO_DEFAULT_FILE
      );
      const decodedContent = decodeURIComponent(escape(window.atob(content)));
      const dataToAppend = `<img src="${domContentResponse.favicon}" alt="${domContentResponse.title}" style="width:15px;margin-bottom: -2px;"/> [${domContentResponse.title}](${domContentResponse.url}) \n> ${domContentResponse.description} \n`;
      // append data in the front
      const appendedContent = appendDataBefore(dataToAppend, decodedContent);
      console.log("appendedContent :>> ", appendedContent);
      const encodedAppendedContent = window.btoa(
        unescape(encodeURIComponent(appendedContent))
      );
      const gitHubCommit = {
        sha,
        content: encodedAppendedContent,
        message: `✨ NEW: BookMarked page from ${domContentResponse.websiteName}`,
        committer: {
          name: userOptions.githubUsername,
          email: `${userOptions.githubUsername}@gitbookmark.io`,
        },
      };
      const data = {
        repoOwner: userOptions.githubUsername,
        repoName: userOptions.githubRepoName,
        readmeFilePath: config.GITHUB_REPO_DEFAULT_FILE,
        githubAccessToken: userOptions.githubToken,
        gitHubCommit,
      };
      const result = await mutation.mutateAsync(data);
      if (result) {
        setBookMarkingStatus(false);
      }
    }
  };

  return (
    <div className="app">
      <Heading padding={16} borderBottom={"1px dashed rgb(223, 226, 229)"}>
        GitHub BookMark
      </Heading>
      {!mutation.isSuccess && (
        <Pane padding={16} background="tint1" flex="1">
          <TextInputField
            spellCheck
            label="Title"
            //hint="Label for the archived link"
            value={domContentResponse.title}
            onChange={(item: React.ChangeEvent<HTMLInputElement>) =>
              setDomContentResponse({
                ...domContentResponse,
                title: item.target.value,
              })
            }
          />
          <TextareaField
            marginTop={"-16px"}
            spellCheck
            grammarly
            label="Comment"
            //hint="GitHub commit message"
            value={domContentResponse.description}
            onChange={(item: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDomContentResponse({
                ...domContentResponse,
                description: item.target.value,
              })
            }
          />
          {repo && (
            <FormField
              marginTop={"-16px"}
              paddingBottom={16}
              hint="Github Repo Directory"
              label="Save In"
              flex="1"
              width="100%"
            >
              <SelectLocationMenu
                repositoryLocations={repo
                  .filter((location: GitHubContent) => location.type === "dir")
                  .map((location: GitHubContent) => location.name)}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
              />
            </FormField>
          )}
          <Button
            marginY={8}
            marginRight={12}
            iconBefore={() => (
              <>
                <KeyOptionIcon />
                <span>+ M</span>
              </>
            )}
            appearance="primary"
            onClick={() => handleSubmission()}
            isLoading={archivingStatus}
          >
            BookMark
          </Button>
          <Button marginY={8} marginRight={12} onClick={() => window.close()}>
            Cancel
          </Button>
        </Pane>
      )}
      {mutation.isSuccess && (
        <Pane paddingY={16} paddingX={16}>
          <Alert intent="success" title=" BookMarked!">
            {`Click anywhere outside this popup to Close.`}
          </Alert>
          <Button marginTop={16} onClick={() => window.close()}>
            Close
          </Button>
        </Pane>
      )}
    </div>
  );
}

export default App;
