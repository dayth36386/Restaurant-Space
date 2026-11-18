package domain

import "errors"

var (
	ErrNotFound     = errors.New("resource not found")
	ErrConflict     = errors.New("resource conflict")
	ErrUnauthorized = errors.New("authentication required")
)

// Error carries an application error code, never an HTTP status.
type Error struct{ Code, Message string }

func (e *Error) Error() string     { return e.Message }
func Invalid(message string) error { return &Error{Code: "INVALID_INPUT", Message: message} }
