package mysql

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

type Store struct{ db *gorm.DB }
type repository struct{ db *gorm.DB }

func New(db *gorm.DB) *Store { return &Store{db: db} }
func (s *Store) Repository(ctx context.Context) port.Repository {
	return &repository{s.db.WithContext(ctx)}
}
func (s *Store) Transaction(ctx context.Context, fn func(port.Repository) error) error {
	return translate(s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error { return fn(&repository{tx}) }))
}
func (s *Store) Ready(ctx context.Context) error {
	db, e := s.db.DB()
	if e != nil {
		return e
	}
	return db.PingContext(ctx)
}
func translate(e error) error {
	switch {
	case errors.Is(e, gorm.ErrRecordNotFound):
		return domain.ErrNotFound
	case errors.Is(e, gorm.ErrDuplicatedKey), errors.Is(e, gorm.ErrForeignKeyViolated):
		return domain.ErrConflict
	default:
		return e
	}
}
func (r *repository) query(lock bool) *gorm.DB {
	if lock {
		return r.db.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	return r.db
}

var _ port.UnitOfWork = (*Store)(nil)
var _ port.Repository = (*repository)(nil)
