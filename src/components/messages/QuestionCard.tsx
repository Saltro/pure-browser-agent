import { Check, HelpCircle, XCircle } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { answerQuestionRequest } from "../../lib/agent";
import type { AgentQuestionAnswer, AppMessage } from "../../types/workbench";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type QuestionRequestMessage = Extract<AppMessage, { type: "question_request" }>;

type QuestionCardProps = {
  event: QuestionRequestMessage;
};

function selectedInputType(
  kind: QuestionRequestMessage["questions"][number]["kind"],
) {
  return kind === "multiple" ? "checkbox" : "radio";
}

export function QuestionCard({ event }: QuestionCardProps) {
  const initialSelected = useMemo(() => {
    return Object.fromEntries(
      event.questions.map((question) => [question.id, [] as string[]]),
    );
  }, [event.questions]);
  const [selectedByQuestion, setSelectedByQuestion] =
    useState<Record<string, string[]>>(initialSelected);
  const [customByQuestion, setCustomByQuestion] = useState<
    Record<string, string>
  >({});
  const [submitting, setSubmitting] = useState(false);

  const disabled = event.status !== "pending" || submitting;

  function updateOption(
    questionId: string,
    optionId: string,
    checked: boolean,
    multiple: boolean,
  ) {
    setSelectedByQuestion((current) => {
      if (!multiple)
        return { ...current, [questionId]: checked ? [optionId] : [] };
      const existing = current[questionId] ?? [];
      return {
        ...current,
        [questionId]: checked
          ? [...existing, optionId]
          : existing.filter((id) => id !== optionId),
      };
    });
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const answers: AgentQuestionAnswer[] = event.questions.map((question) => {
      const selectedOptionIds = selectedByQuestion[question.id] ?? [];
      const customText = customByQuestion[question.id]?.trim();
      return {
        questionId: question.id,
        ...(selectedOptionIds.length ? { selectedOptionIds } : {}),
        ...(customText ? { customText } : {}),
      };
    });

    setSubmitting(true);
    try {
      await answerQuestionRequest(event.toolCallId, answers);
    } finally {
      setSubmitting(false);
    }
  }

  if (event.status !== "pending") {
    return (
      <div className="questionCard compact">
        {event.status === "answered" ? (
          <Check size={16} />
        ) : (
          <XCircle size={16} />
        )}
        <div className="questionSummary">
          <div className="questionHeader">
            <strong>
              {event.questions.length === 1
                ? event.questions[0].title
                : `${event.questions.length} questions`}
            </strong>
            <Badge variant="secondary">{event.status}</Badge>
          </div>
          {event.questions.length > 1 && (
            <p>
              {event.questions.map((question) => question.title).join(" · ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form className="questionCard" onSubmit={handleSubmit}>
      <div className="questionBody">
        <div className="questionHeader">
          <strong>
            {event.questions.length === 1 ? "Question" : "Questions"}
          </strong>
          <Badge className="pending">pending</Badge>
        </div>
        <div className="questionList">
          {event.questions.map((question) => {
            const selected = selectedByQuestion[question.id] ?? [];
            const isTextOnly = question.kind === "text";
            return (
              <fieldset
                key={question.id}
                className="questionField"
                disabled={disabled}
              >
                <legend>{question.title}</legend>
                {question.description && <p>{question.description}</p>}
                {!isTextOnly && question.options?.length ? (
                  <div className="questionOptions">
                    {question.options.map((option) => (
                      <label key={option.id} className="questionOption">
                        <input
                          type={selectedInputType(question.kind)}
                          name={question.id}
                          checked={selected.includes(option.id)}
                          onChange={(changeEvent) =>
                            updateOption(
                              question.id,
                              option.id,
                              changeEvent.currentTarget.checked,
                              question.kind === "multiple",
                            )
                          }
                        />
                        <span>
                          <span>{option.label}</span>
                          {option.description && (
                            <small>{option.description}</small>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
                <Input
                  value={customByQuestion[question.id] ?? ""}
                  onChange={(changeEvent) =>
                    setCustomByQuestion((current) => ({
                      ...current,
                      [question.id]: changeEvent.currentTarget.value,
                    }))
                  }
                  placeholder="Custom answer"
                  disabled={disabled}
                />
              </fieldset>
            );
          })}
        </div>
        <div className="questionActions">
          <Button size="sm" type="submit" disabled={disabled}>
            Submit
          </Button>
        </div>
      </div>
    </form>
  );
}
