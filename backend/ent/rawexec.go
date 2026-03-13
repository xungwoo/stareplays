package ent

import (
	"context"
	"database/sql"
	"fmt"

	entsql "entgo.io/ent/dialect/sql"
)

// ExecContext exposes raw exec on the underlying ent client driver.
func (c *Client) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	execer, ok := c.driver.(interface {
		ExecContext(context.Context, string, ...any) (sql.Result, error)
	})
	if ok {
		return execer.ExecContext(ctx, query, args...)
	}

	var result sql.Result
	if err := c.driver.Exec(ctx, query, args, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// QueryContext exposes raw query on the underlying ent client driver.
func (c *Client) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	queryer, ok := c.driver.(interface {
		QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	})
	if ok {
		return queryer.QueryContext(ctx, query, args...)
	}

	var rows entsql.Rows
	if err := c.driver.Query(ctx, query, args, &rows); err != nil {
		return nil, err
	}
	sqlRows, ok := rows.ColumnScanner.(*sql.Rows)
	if !ok {
		return nil, fmt.Errorf("ent client driver returned non-*sql.Rows scanner: %T", rows.ColumnScanner)
	}
	return sqlRows, nil
}

// ExecContext exposes raw exec on the underlying ent transaction driver.
func (tx *Tx) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	execer, ok := tx.config.driver.(interface {
		ExecContext(context.Context, string, ...any) (sql.Result, error)
	})
	if ok {
		return execer.ExecContext(ctx, query, args...)
	}

	var result sql.Result
	if err := tx.config.driver.Exec(ctx, query, args, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// QueryContext exposes raw query on the underlying ent transaction driver.
func (tx *Tx) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	queryer, ok := tx.config.driver.(interface {
		QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	})
	if ok {
		return queryer.QueryContext(ctx, query, args...)
	}

	var rows entsql.Rows
	if err := tx.config.driver.Query(ctx, query, args, &rows); err != nil {
		return nil, err
	}
	sqlRows, ok := rows.ColumnScanner.(*sql.Rows)
	if !ok {
		return nil, fmt.Errorf("ent tx driver returned non-*sql.Rows scanner: %T", rows.ColumnScanner)
	}
	return sqlRows, nil
}
